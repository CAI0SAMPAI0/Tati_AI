import urllib.request
import re
import json
import time
import os
import sys

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

CATEGORIES = {
    'grammar': 'grammar-points',
    'vocabulary': 'vocabulary',
    'listening': 'listening',
    'reading': 'reading'
}

LEVEL_MAP = {
    'a1': 'A1',
    'a2': 'A2',
    'b1': 'B1',
    'b1-b2': 'B1+',
    'b2': 'B2',
    'c1': 'C1'
}

def clean_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', '', text)
    # Replace common HTML entities
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&quot;', '"').replace('&apos;', "'").replace('&#8217;', "'").replace('&#8211;', '-').replace('&#8212;', '-')
    return text.strip()

def extract_items_from_html(html: str, category_slug: str, level_slug: str, level_code: str) -> list[dict]:
    # Each test item on test-english has:
    # <div class="test-item ...">
    #   <div class="pill hoverable">
    #     <a href="..." title="..." rel="bookmark">
    #       <img ... src="..." ...>
    #       <div class="pill-body test-item-caption">
    #         <h4>Title</h4>
    #       </div>
    #     </a>
    #   </div>
    # </div>
    
    # Pattern to find test-item blocks
    item_blocks = re.findall(
        r'<div[^>]*class=["\'][^"\']*test-item[^"\']*["\'][^>]*>(.*?)</div>\s*</div>',
        html,
        re.DOTALL
    )
    
    results = []
    seen_urls = set()
    
    for block in item_blocks:
        # Extract <a> tag
        a_match = re.search(r'<a[^>]+href=["\'](https://test-english\.com/[^"\']+)["\']([^>]*)>(.*?)</a>', block, re.DOTALL)
        if not a_match:
            # Fallback search anywhere in block
            a_match = re.search(r'<a[^>]+href=["\'](https://test-english\.com/[^"\']+)["\']', block)
            if not a_match:
                continue
            url = a_match.group(1).strip()
            a_attrs = ""
            inner = block
        else:
            url = a_match.group(1).strip()
            a_attrs = a_match.group(2)
            inner = a_match.group(3)
            
        # Clean URL
        url = url.split('#')[0].split('?')[0]
        if not url.endswith('/'):
            url += '/'
            
        # Skip level/category archive links
        if url.rstrip('/') == f"https://test-english.com/{category_slug}/{level_slug}":
            continue
        if url.rstrip('/') == f"https://test-english.com/{category_slug}":
            continue
            
        if url in seen_urls:
            continue
        seen_urls.add(url)
        
        # Extract title: check <h4>, title attribute, or inner text
        title = ""
        h4_match = re.search(r'<h4[^>]*>(.*?)</h4>', inner, re.DOTALL)
        if h4_match:
            title = clean_html(h4_match.group(1))
        if not title:
            title_attr_m = re.search(r'title=["\']([^"\']+)["\']', a_attrs)
            if title_attr_m:
                title = clean_html(title_attr_m.group(1))
        if not title:
            # Fallback: remove all tags and get non-empty line
            cleaned = clean_html(inner)
            lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
            if lines:
                title = lines[-1]
                
        # Extract image
        img_url = ""
        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', inner)
        if img_match:
            img_url = img_match.group(1).strip()
        if not img_url or 'data:image' in img_url or img_url.endswith('.svg'):
            data_src_m = re.search(r'<img[^>]+data-src=["\']([^"\']+)["\']', inner)
            if data_src_m:
                img_url = data_src_m.group(1).strip()
                
        # Extract slug from URL
        slug = url.rstrip('/').split('/')[-1]
        
        results.append({
            "slug": slug,
            "title": title or slug.replace('-', ' ').title(),
            "url": url,
            "image": img_url,
            "level": level_code
        })
        
    return results

def scrape_all():
    all_data = {
        'grammar': {},
        'vocabulary': {},
        'listening': {},
        'reading': {}
    }
    
    total_count = 0
    
    for cat_key, cat_slug in CATEGORIES.items():
        print(f"\n==========================================")
        print(f"Scraping Category: {cat_key} ({cat_slug})")
        print(f"==========================================")
        
        for lvl_slug, lvl_code in LEVEL_MAP.items():
            page_url = f"https://test-english.com/{cat_slug}/{lvl_slug}/"
            print(f"Fetching [{cat_key}] [{lvl_code}] from {page_url} ...")
            
            try:
                req = urllib.request.Request(page_url, headers=headers)
                with urllib.request.urlopen(req, timeout=20) as resp:
                    html = resp.read().decode('utf-8', errors='ignore')
                    items = extract_items_from_html(html, cat_slug, lvl_slug, lvl_code)
                    print(f"  -> Found {len(items)} items for {lvl_code}")
                    
                    all_data[cat_key][lvl_code] = items
                    # Also alias B1-B2 if B1+
                    if lvl_code == 'B1+':
                        all_data[cat_key]['B1-B2'] = items
                        
                    total_count += len(items)
            except Exception as e:
                print(f"  -> ERROR fetching {page_url}: {e}")
                all_data[cat_key][lvl_code] = []
                
            time.sleep(0.4)
            
    print(f"\n==========================================")
    print(f"Total items extracted: {total_count}")
    print(f"==========================================")
    
    # Save to te_english_data.json
    output_path = os.path.join(os.path.dirname(__file__), '..', 'apps', 'activities', 'data', 'te_english_data.json')
    output_path = os.path.abspath(output_path)
    
    # Create backup of previous data first
    backup_path = output_path + '.backup'
    if os.path.exists(output_path):
        import shutil
        shutil.copyfile(output_path, backup_path)
        print(f"Created backup at {backup_path}")
        
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
        
    print(f"Saved new te_english_data.json to {output_path} (size: {os.path.getsize(output_path)} bytes)")
    return all_data

if __name__ == '__main__':
    scrape_all()
