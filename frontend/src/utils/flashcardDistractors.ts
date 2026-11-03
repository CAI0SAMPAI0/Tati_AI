/**
 * Smart Semantic Distractor Generator for Flashcards
 * Generates plausible, contextually-related alternative options for vocabulary testing
 * without repeating words from other cards in the deck.
 */

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function cleanWord(w: string): string {
  return w.trim().toLowerCase().replace(/[.,!?;:'"()]/g, '');
}

export const SEMANTIC_CATEGORIES: Record<string, string[]> = {
  weather: [
    'Sunny', 'Rainy', 'Cloudy', 'Windy', 'Stormy', 'Snowy', 'Foggy', 'Chilly',
    'Breezy', 'Freezing', 'Humid', 'Overcast', 'Mild', 'Hailing', 'Drizzling',
    'Scorching', 'Thunderstorm', 'Icy', 'Warm', 'Cold', 'Damp', 'Gloomy'
  ],
  rooms_house: [
    'Living room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining room', 'Attic',
    'Basement', 'Garage', 'Balcony', 'Hallway', 'Porch', 'Pantry',
    'Laundry room', 'Garden', 'Patio', 'Terrace', 'Study room', 'Closet'
  ],
  furniture: [
    'Sofa', 'Armchair', 'Coffee table', 'Bookshelf', 'Wardrobe', 'Desk', 'Chair',
    'Bed', 'Nightstand', 'Lamp', 'Mirror', 'Carpet', 'Cushion', 'Cabinet',
    'Dresser', 'Stool', 'Curtains', 'Dining table', 'Cupboard', 'Rug'
  ],
  appliances: [
    'Refrigerator', 'Microwave', 'Oven', 'Toaster', 'Blender', 'Dishwasher',
    'Washing machine', 'Vacuum cleaner', 'Kettle', 'Iron', 'Air conditioner',
    'Heater', 'Coffee maker', 'Food processor', 'Fan'
  ],
  clothes: [
    'Jacket', 'Coat', 'Shirt', 'T-shirt', 'Pants', 'Jeans', 'Sweater', 'Hoodie',
    'Dress', 'Skirt', 'Suit', 'Shorts', 'Socks', 'Shoes', 'Boots', 'Sneakers',
    'Sandals', 'Slippers', 'Raincoat', 'Cardigan', 'Blouse', 'Overalls'
  ],
  accessories: [
    'Hat', 'Cap', 'Scarf', 'Gloves', 'Belt', 'Tie', 'Watch', 'Glasses',
    'Sunglasses', 'Necklace', 'Bracelet', 'Ring', 'Earrings', 'Backpack',
    'Handbag', 'Wallet', 'Umbrella', 'Bowtie', 'Purse'
  ],
  jobs: [
    'Doctor', 'Nurse', 'Surgeon', 'Dentist', 'Teacher', 'Professor', 'Engineer',
    'Architect', 'Lawyer', 'Judge', 'Police officer', 'Firefighter', 'Pilot',
    'Flight attendant', 'Chef', 'Waiter', 'Waitress', 'Photographer', 'Journalist',
    'Scientist', 'Electrician', 'Plumber', 'Mechanic', 'Accountant', 'Farmer', 'Actor',
    'Artist', 'Veterinarian', 'Librarian', 'Pharmacist'
  ],
  family: [
    'Mother', 'Father', 'Brother', 'Sister', 'Son', 'Daughter', 'Grandmother',
    'Grandfather', 'Uncle', 'Aunt', 'Cousin', 'Nephew', 'Niece', 'Husband',
    'Wife', 'Partner', 'Friend', 'Colleague', 'Neighbor', 'Parents', 'Grandchildren'
  ],
  food: [
    'Bread', 'Cheese', 'Butter', 'Egg', 'Rice', 'Pasta', 'Pizza', 'Burger',
    'Sandwich', 'Soup', 'Salad', 'Steak', 'Chicken', 'Fish', 'Sausage',
    'Bacon', 'Ham', 'Noodles', 'Pancakes', 'Waffles', 'Pie', 'Roast'
  ],
  meals: [
    'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Brunch', 'Dessert',
    'Appetizer', 'Buffet', 'Picnic', 'Supper', 'Takeout'
  ],
  fruits: [
    'Apple', 'Banana', 'Orange', 'Strawberry', 'Grape', 'Watermelon', 'Pineapple',
    'Mango', 'Peach', 'Lemon', 'Lime', 'Cherry', 'Avocado', 'Pear', 'Plum', 'Kiwi'
  ],
  vegetables: [
    'Tomato', 'Potato', 'Carrot', 'Onion', 'Garlic', 'Broccoli', 'Cucumber',
    'Lettuce', 'Mushroom', 'Pepper', 'Spinach', 'Corn', 'Peas', 'Cabbage'
  ],
  drinks: [
    'Coffee', 'Tea', 'Water', 'Milk', 'Orange juice', 'Lemonade', 'Soda',
    'Smoothie', 'Milkshake', 'Hot chocolate', 'Iced tea', 'Cider'
  ],
  animals_pets: [
    'Dog', 'Cat', 'Horse', 'Cow', 'Sheep', 'Pig', 'Goat', 'Rabbit', 'Donkey',
    'Duck', 'Chicken', 'Hamster', 'Parrot', 'Goldfish', 'Puppy', 'Kitten', 'Turkey'
  ],
  animals_wild: [
    'Lion', 'Tiger', 'Elephant', 'Giraffe', 'Zebra', 'Monkey', 'Bear', 'Wolf',
    'Fox', 'Deer', 'Kangaroo', 'Panda', 'Gorilla', 'Hippo', 'Rhino', 'Leopard',
    'Camel', 'Cheetah', 'Crocodile'
  ],
  sea_animals: [
    'Dolphin', 'Whale', 'Shark', 'Octopus', 'Turtle', 'Seal', 'Jellyfish',
    'Crab', 'Lobster', 'Starfish', 'Seahorse', 'Penguin', 'Squid', 'Salmon', 'Stingray'
  ],
  birds_insects: [
    'Eagle', 'Owl', 'Hawk', 'Parrot', 'Pigeon', 'Sparrow', 'Crow', 'Swan',
    'Flamingo', 'Butterfly', 'Bee', 'Ant', 'Spider', 'Dragonfly', 'Ladybug', 'Beetle'
  ],
  transport: [
    'Airplane', 'Helicopter', 'Train', 'Subway', 'Bus', 'Car', 'Taxi', 'Bicycle',
    'Motorcycle', 'Scooter', 'Boat', 'Ferry', 'Cruise ship', 'Yacht', 'Van', 'Truck', 'Ambulance'
  ],
  travel_places: [
    'Airport', 'Train station', 'Bus stop', 'Harbor', 'Hotel', 'Resort',
    'Hostel', 'Passport', 'Suitcase', 'Luggage', 'Boarding pass', 'Ticket',
    'Platform', 'Terminal', 'Customs', 'Departure lounge'
  ],
  city_places: [
    'Hospital', 'School', 'University', 'Library', 'Museum', 'Cinema', 'Theater',
    'Bank', 'Post office', 'Pharmacy', 'Supermarket', 'Bakery', 'Restaurant',
    'Cafe', 'Church', 'Stadium', 'Park', 'Gym', 'Shopping mall', 'Bookstore'
  ],
  nature_geo: [
    'Mountain', 'Valley', 'River', 'Lake', 'Ocean', 'Sea', 'Waterfall',
    'Forest', 'Jungle', 'Desert', 'Island', 'Beach', 'Cave', 'Hill', 'Cliff', 'Volcano'
  ],
  emotions_feelings: [
    'Happy', 'Cheerful', 'Excited', 'Grateful', 'Proud', 'Relieved', 'Calm',
    'Relaxed', 'Confident', 'Sad', 'Angry', 'Anxious', 'Nervous', 'Scared',
    'Frustrated', 'Disappointed', 'Bored', 'Exhausted', 'Jealous', 'Surprised', 'Confused'
  ],
  technology: [
    'Computer', 'Laptop', 'Tablet', 'Smartphone', 'Smartwatch', 'Headphones',
    'Earphones', 'Keyboard', 'Mouse', 'Monitor', 'Camera', 'Drone', 'Speaker',
    'Microphone', 'Printer', 'Charger', 'Screen'
  ],
  hobbies_sports: [
    'Soccer', 'Basketball', 'Tennis', 'Volleyball', 'Golf', 'Surfing',
    'Skateboarding', 'Cycling', 'Hiking', 'Camping', 'Fishing', 'Painting',
    'Drawing', 'Gardening', 'Cooking', 'Dancing', 'Gaming', 'Reading', 'Running', 'Swimming'
  ],
  music_instruments: [
    'Guitar', 'Piano', 'Violin', 'Drums', 'Flute', 'Saxophone', 'Trumpet',
    'Cello', 'Harp', 'Clarinet', 'Keyboard', 'Bass guitar', 'Accordion', 'Trombone'
  ],
  health_body: [
    'Headache', 'Fever', 'Cough', 'Sore throat', 'Stomachache', 'Allergy', 'Flu',
    'Bandage', 'Pill', 'Prescription', 'Appointment', 'Clinic', 'Emergency',
    'Medicine', 'Vitamins', 'First aid'
  ],
  daily_routine: [
    'Wake up', 'Get dressed', 'Brush teeth', 'Take a shower', 'Comb hair',
    'Cook dinner', 'Wash dishes', 'Do laundry', 'Go to work', 'Catch the bus',
    'Eat breakfast', 'Study English', 'Clean the room', 'Go to sleep'
  ],
  business_office: [
    'Meeting', 'Presentation', 'Negotiation', 'Contract', 'Budget', 'Investment',
    'Deadline', 'Strategy', 'Report', 'Executive', 'Manager', 'Client', 'Customer',
    'Agreement', 'Interview', 'Colleague'
  ],
  descriptions_quality: [
    'Fast', 'Slow', 'Bright', 'Dark', 'Quiet', 'Noisy', 'Heavy', 'Light',
    'Clean', 'Dirty', 'Modern', 'Ancient', 'Expensive', 'Cheap', 'Easy',
    'Difficult', 'Soft', 'Hard', 'Smooth', 'Rough', 'Sharp'
  ],
};

// General high-frequency CEFR backup pools (A1-B2)
export const GENERAL_VOCABULARY_BACKUP = [
  'Opportunity', 'Challenge', 'Tradition', 'Adventure', 'Experience', 'Community',
  'Environment', 'Discovery', 'Celebration', 'Achievement', 'Knowledge', 'Memory',
  'Direction', 'Connection', 'Perspective', 'Creativity', 'Inspiration', 'Progress',
  'Improvement', 'Foundation', 'Solution', 'Moment', 'Resource', 'Attitude',
];

/**
 * Finds the most relevant category for a given word and/or deck topic
 */
function detectCategory(targetWord: string, deckTopic?: string): string[] | null {
  const cleanTarget = cleanWord(targetWord);
  const cleanTopic = cleanWord(deckTopic || '');

  // 1. Direct topic keyword matching
  for (const [catName, words] of Object.entries(SEMANTIC_CATEGORIES)) {
    const key = catName.toLowerCase();
    if (
      cleanTopic.includes(key) ||
      (key === 'weather' && cleanTopic.includes('weather')) ||
      (key === 'rooms_house' && (cleanTopic.includes('room') || cleanTopic.includes('house'))) ||
      (key === 'clothes' && (cleanTopic.includes('cloth') || cleanTopic.includes('wear') || cleanTopic.includes('fashion'))) ||
      (key === 'jobs' && (cleanTopic.includes('job') || cleanTopic.includes('profession') || cleanTopic.includes('career') || cleanTopic.includes('work'))) ||
      (key === 'family' && (cleanTopic.includes('family') || cleanTopic.includes('relation'))) ||
      (key === 'food' && (cleanTopic.includes('food') || cleanTopic.includes('meal') || cleanTopic.includes('kitchen') || cleanTopic.includes('cook'))) ||
      (key === 'daily_routine' && (cleanTopic.includes('routine') || cleanTopic.includes('daily') || cleanTopic.includes('habit'))) ||
      (key === 'hobbies_sports' && (cleanTopic.includes('hobbi') || cleanTopic.includes('sport') || cleanTopic.includes('weekend'))) ||
      (key === 'health_body' && (cleanTopic.includes('health') || cleanTopic.includes('lifestyle') || cleanTopic.includes('medic'))) ||
      (key === 'transport' && (cleanTopic.includes('travel') || cleanTopic.includes('trip') || cleanTopic.includes('transport')))
    ) {
      // Check if target word exists in this or related pool
      return words;
    }
  }

  // 2. Direct word membership in category
  for (const words of Object.values(SEMANTIC_CATEGORIES)) {
    const hasWord = words.some((w) => cleanWord(w) === cleanTarget || cleanTarget.includes(cleanWord(w)) || cleanWord(w).includes(cleanTarget));
    if (hasWord) {
      return words;
    }
  }

  return null;
}

/**
 * Shuffles an array in place using Fisher-Yates
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates 3 semantic distractors for the given targetWord.
 *
 * Rules:
 * 1. Distractors are related to the word / topic ("palavras que tenham a ver com a correta mas não são").
 * 2. Words in `excludeWords` (e.g. other cards in the same deck) are STRICTLY excluded.
 * 3. Never returns duplicates.
 * 4. Never returns the target word itself.
 */
export function getSemanticDistractors(
  targetWord: string,
  deckTopic: string = '',
  excludeWords: string[] = []
): string[] {
  const cleanTarget = cleanWord(targetWord);
  const excludedSet = new Set(
    excludeWords.map((w) => cleanWord(w)).filter(Boolean)
  );
  excludedSet.add(cleanTarget);

  const matchedCategory = detectCategory(targetWord, deckTopic);
  const chosenDistractors: string[] = [];

  if (matchedCategory && matchedCategory.length > 0) {
    const candidates = shuffle(matchedCategory).filter((w) => {
      const cw = cleanWord(w);
      return !excludedSet.has(cw) && cw !== cleanTarget;
    });

    for (const c of candidates) {
      if (chosenDistractors.length >= 3) break;
      chosenDistractors.push(capitalize(c));
      excludedSet.add(cleanWord(c));
    }
  }

  // If we still need more distractors, draw from other categories
  if (chosenDistractors.length < 3) {
    const allCategoryWords = Object.values(SEMANTIC_CATEGORIES).flat();
    const otherCandidates = shuffle(allCategoryWords).filter((w) => {
      const cw = cleanWord(w);
      return !excludedSet.has(cw) && cw !== cleanTarget;
    });

    for (const c of otherCandidates) {
      if (chosenDistractors.length >= 3) break;
      chosenDistractors.push(capitalize(c));
      excludedSet.add(cleanWord(c));
    }
  }

  // Final fallback to diverse CEFR pool
  if (chosenDistractors.length < 3) {
    const backupCandidates = shuffle(GENERAL_VOCABULARY_BACKUP).filter((w) => {
      const cw = cleanWord(w);
      return !excludedSet.has(cw) && cw !== cleanTarget;
    });

    for (const c of backupCandidates) {
      if (chosenDistractors.length >= 3) break;
      chosenDistractors.push(capitalize(c));
      excludedSet.add(cleanWord(c));
    }
  }

  return chosenDistractors.slice(0, 3);
}
