import logging
import json
import os
import argparse


def read_env_file(path):
    if not os.path.exists(path):
        return {}
    data = {}
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            data[k.strip()] = v.strip().strip('"').strip("'")
    return data


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--env', help='Path to .env file to read (optional)')
    p.add_argument('--url', help='Set server.url directly')
    args = p.parse_args()

    url = None
    if args.url:
        url = args.url
    elif args.env:
        env = read_env_file(args.env)
        # common names
        url = env.get('FRONTEND_URL') or env.get('VERCEL_URL') or env.get(
            'NEXT_PUBLIC_URL') or env.get('FRONTEND_PROD_URL')

    if not url:
        url = 'http://localhost:3000'

    cfg_path = os.path.join(
        os.path.dirname(__file__),
        'capacitor.config.json')
    if not os.path.exists(cfg_path):
        logging.info('capacitor.config.json not found at', cfg_path)
        return

    with open(cfg_path, 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    if 'server' not in cfg:
        cfg['server'] = {}
    cfg['server']['url'] = url
    # If url is http, allow cleartext for dev
    cfg['server']['cleartext'] = url.startswith('http://')

    with open(cfg_path, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

    logging.info('Updated capacitor.config.json server.url ->', url)


if __name__ == '__main__':
    main()
