import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const recipes = [
  {
    "title": "Classic Spaghetti Bolognese",
    "description": "A rich and hearty traditional Italian meat sauce served over al dente spaghetti.",
    "servings": 6,
    "prepTimeMin": 20,
    "cookTimeMin": 120,
    "cuisine": "Italian",
    "difficulty": "medium",
    "ingredients": [
      { "name": "ground beef", "amount": "1", "unit": "lbs" },
      { "name": "spaghetti", "amount": "16", "unit": "oz" },
      { "name": "crushed tomatoes", "amount": "28", "unit": "oz" },
      { "name": "onion, finely chopped", "amount": "1", "unit": "whole" },
      { "name": "garlic, minced", "amount": "4", "unit": "cloves" }
    ],
    "steps": [
      "Sauté onions and garlic in olive oil until translucent.",
      "Add ground beef and brown thoroughly, draining excess fat.",
      "Stir in crushed tomatoes, reduce heat, and simmer for at least 1.5 hours.",
      "Boil spaghetti in salted water until al dente, drain, and serve with sauce."
    ],
    "notes": "Simmering longer (up to 3 hours) deepens the flavor. Top with fresh parmesan.",
    "nutrition": { "calories": 450, "protein": 24, "fat": 15, "carbs": 55, "fiber": 4 }
  },
  {
    "title": "Vegan Chickpea Tikka Masala",
    "description": "A plant-based take on the classic Indian dish, featuring tender chickpeas in a creamy, spiced tomato sauce.",
    "servings": 4,
    "prepTimeMin": 15,
    "cookTimeMin": 25,
    "cuisine": "Indian",
    "difficulty": "easy",
    "ingredients": [
      { "name": "chickpeas, drained", "amount": "2", "unit": "cans" },
      { "name": "coconut milk", "amount": "1", "unit": "can" },
      { "name": "tomato paste", "amount": "3", "unit": "tbsp" },
      { "name": "garam masala", "amount": "1.5", "unit": "tbsp" },
      { "name": "ginger, grated", "amount": "1", "unit": "tbsp" }
    ],
    "steps": [
      "Heat a splash of oil in a pot and cook ginger and garam masala until fragrant.",
      "Whisk in tomato paste and coconut milk until smooth.",
      "Fold in chickpeas and simmer for 15-20 minutes until the sauce thickens.",
      "Garnish with cilantro and serve over basmati rice."
    ],
    "notes": "For extra veggies, stir in a handful of spinach during the last 3 minutes of cooking.",
    "nutrition": { "calories": 380, "protein": 12, "fat": 22, "carbs": 35, "fiber": 9 }
  },
  {
    "title": "Baja Fish Tacos",
    "description": "Crispy battered white fish folded into warm tortillas, topped with a zesty cabbage slaw.",
    "servings": 4,
    "prepTimeMin": 20,
    "cookTimeMin": 15,
    "cuisine": "Mexican",
    "difficulty": "medium",
    "ingredients": [
      { "name": "cod fillets", "amount": "1.5", "unit": "lbs" },
      { "name": "corn tortillas", "amount": "8", "unit": "whole" },
      { "name": "shredded cabbage", "amount": "2", "unit": "cups" },
      { "name": "lime juice", "amount": "2", "unit": "tbsp" },
      { "name": "crema or sour cream", "amount": "0.5", "unit": "cups" }
    ],
    "steps": [
      "Toss shredded cabbage with lime juice and a pinch of salt to make the slaw.",
      "Cut cod into 2-inch strips, coat in your favorite batter, and fry until crispy and golden.",
      "Warm the tortillas in a dry skillet.",
      "Assemble tacos with fish, slaw, and a drizzle of crema."
    ],
    "notes": "A dusting of chili powder in the batter adds a nice kick.",
    "nutrition": { "calories": 410, "protein": 28, "fat": 14, "carbs": 42, "fiber": 5 }
  },
  {
    "title": "Authentic Greek Salad",
    "description": "A crisp, refreshing Mediterranean salad with no lettuce, just pure vegetables and creamy feta.",
    "servings": 2,
    "prepTimeMin": 15,
    "cookTimeMin": 0,
    "cuisine": "Mediterranean",
    "difficulty": "easy",
    "ingredients": [
      { "name": "cucumber, sliced", "amount": "1", "unit": "large" },
      { "name": "tomatoes, wedged", "amount": "3", "unit": "medium" },
      { "name": "kalamata olives", "amount": "0.5", "unit": "cups" },
      { "name": "feta cheese block", "amount": "4", "unit": "oz" },
      { "name": "extra virgin olive oil", "amount": "3", "unit": "tbsp" }
    ],
    "steps": [
      "Combine cucumber, tomatoes, and olives in a shallow bowl.",
      "Place the whole block of feta cheese directly on top of the vegetables.",
      "Drizzle generously with olive oil and sprinkle with dried oregano.",
      "Serve immediately with crusty bread for dipping."
    ],
    "notes": "Do not crumble the feta! Serving it in a block is the traditional Greek method.",
    "nutrition": { "calories": 290, "protein": 9, "fat": 25, "carbs": 10, "fiber": 3 }
  },
  {
    "title": "Quick Miso Soup",
    "description": "A comforting, umami-rich Japanese staple that comes together in minutes.",
    "servings": 4,
    "prepTimeMin": 5,
    "cookTimeMin": 10,
    "cuisine": "Japanese",
    "difficulty": "easy",
    "ingredients": [
      { "name": "dashi stock", "amount": "4", "unit": "cups" },
      { "name": "white miso paste", "amount": "3", "unit": "tbsp" },
      { "name": "silken tofu, cubed", "amount": "8", "unit": "oz" },
      { "name": "wakame (dried seaweed)", "amount": "1", "unit": "tbsp" },
      { "name": "green onions, sliced", "amount": "2", "unit": "whole" }
    ],
    "steps": [
      "Bring dashi stock to a gentle simmer in a medium pot.",
      "Rehydrate the wakame in water for 5 minutes, drain, and add to the pot along with the tofu.",
      "Remove pot from heat. Ladle a little hot broth into a bowl with the miso paste and whisk until smooth.",
      "Stir the miso slurry back into the pot. Top with green onions and serve."
    ],
    "notes": "Never boil the soup after adding the miso paste, as it will destroy the delicate flavors and beneficial probiotics.",
    "nutrition": { "calories": 65, "protein": 6, "fat": 2, "carbs": 5, "fiber": 1 }
  },
  {
    "title": "Steak Frites",
    "description": "A classic French bistro meal featuring a perfectly seared steak and crispy golden fries.",
    "servings": 2,
    "prepTimeMin": 20,
    "cookTimeMin": 30,
    "cuisine": "French",
    "difficulty": "medium",
    "ingredients": [
      { "name": "ribeye or strip steak", "amount": "2", "unit": "steaks" },
      { "name": "russet potatoes", "amount": "3", "unit": "large" },
      { "name": "butter", "amount": "2", "unit": "tbsp" },
      { "name": "garlic", "amount": "2", "unit": "cloves" },
      { "name": "vegetable oil", "amount": "4", "unit": "cups" }
    ],
    "steps": [
      "Cut potatoes into fries, soak in cold water for 30 minutes, then dry thoroughly.",
      "Heat oil to 350°F and fry potatoes until golden. Drain and salt immediately.",
      "Season steaks generously with salt and pepper. Sear in a hot skillet for 3-4 minutes per side for medium-rare.",
      "During the last minute of cooking, baste the steaks with butter and crushed garlic. Rest for 5 minutes before serving with fries."
    ],
    "notes": "For the best fries, fry them twice: once at 325°F to cook the inside, and again at 375°F to crisp the outside.",
    "nutrition": { "calories": 850, "protein": 52, "fat": 58, "carbs": 45, "fiber": 5 }
  },
  {
    "title": "Thai Green Curry",
    "description": "A vibrant and aromatic curry balancing sweet, spicy, and savory flavors.",
    "servings": 4,
    "prepTimeMin": 15,
    "cookTimeMin": 20,
    "cuisine": "Thai",
    "difficulty": "medium",
    "ingredients": [
      { "name": "chicken thigh meat, sliced", "amount": "1", "unit": "lbs" },
      { "name": "green curry paste", "amount": "3", "unit": "tbsp" },
      { "name": "coconut milk", "amount": "1", "unit": "can" },
      { "name": "bamboo shoots", "amount": "0.5", "unit": "cups" },
      { "name": "fish sauce", "amount": "1", "unit": "tbsp" }
    ],
    "steps": [
      "Heat a pan and fry the green curry paste until aromatic.",
      "Add a splash of coconut milk and stir until the oil begins to separate.",
      "Add chicken and cook until opaque, then pour in the rest of the coconut milk.",
      "Add bamboo shoots and fish sauce, simmer for 10 minutes, and serve with jasmine rice."
    ],
    "notes": "Adjust the curry paste amount depending on your spice tolerance.",
    "nutrition": { "calories": 390, "protein": 24, "fat": 28, "carbs": 10, "fiber": 2 }
  },
  {
    "title": "Lebanese Hummus",
    "description": "Ultra-smooth and creamy traditional hummus, perfect as a dip or spread.",
    "servings": 6,
    "prepTimeMin": 15,
    "cookTimeMin": 0,
    "cuisine": "Middle Eastern",
    "difficulty": "easy",
    "ingredients": [
      { "name": "chickpeas", "amount": "1", "unit": "can" },
      { "name": "tahini", "amount": "0.5", "unit": "cups" },
      { "name": "lemon juice", "amount": "3", "unit": "tbsp" },
      { "name": "garlic", "amount": "1", "unit": "clove" },
      { "name": "ice cubes", "amount": "3", "unit": "whole" }
    ],
    "steps": [
      "Process tahini and lemon juice in a food processor for 1 minute until whipped.",
      "Add garlic and drained chickpeas, blending for 2 minutes until very thick.",
      "While the processor is running, drop in ice cubes one at a time to achieve an ultra-light, fluffy texture.",
      "Spoon into a bowl, create a well, and drizzle heavily with olive oil."
    ],
    "notes": "For the absolute best texture, boil the canned chickpeas for 15 minutes with baking soda, then rinse before blending.",
    "nutrition": { "calories": 180, "protein": 6, "fat": 12, "carbs": 14, "fiber": 4 }
  },
  {
    "title": "Classic American Cheeseburger",
    "description": "A juicy, perfectly seared beef patty topped with melted cheese on a toasted bun.",
    "servings": 4,
    "prepTimeMin": 10,
    "cookTimeMin": 10,
    "cuisine": "American",
    "difficulty": "easy",
    "ingredients": [
      { "name": "ground beef (80/20)", "amount": "1.5", "unit": "lbs" },
      { "name": "American cheese", "amount": "4", "unit": "slices" },
      { "name": "hamburger buns", "amount": "4", "unit": "whole" },
      { "name": "lettuce", "amount": "4", "unit": "leaves" },
      { "name": "tomato, sliced", "amount": "4", "unit": "slices" }
    ],
    "steps": [
      "Divide the beef into 4 equal portions and form into patties slightly wider than the buns. Season with salt.",
      "Heat a cast-iron skillet over medium-high heat. Sear patties for 3-4 minutes on the first side.",
      "Flip the burgers, immediately add a slice of cheese to each, and cook for another 3 minutes.",
      "Toast the buns, assemble the burgers with lettuce and tomato, and serve."
    ],
    "notes": "Press a small dimple into the center of the raw patties to prevent them from puffing up while cooking.",
    "nutrition": { "calories": 520, "protein": 34, "fat": 32, "carbs": 24, "fiber": 1 }
  },
  {
    "title": "Mushroom Risotto",
    "description": "A creamy, slow-cooked Italian rice dish packed with earthy mushroom flavor.",
    "servings": 4,
    "prepTimeMin": 15,
    "cookTimeMin": 40,
    "cuisine": "Italian",
    "difficulty": "hard",
    "ingredients": [
      { "name": "Arborio rice", "amount": "1.5", "unit": "cups" },
      { "name": "cremini mushrooms, sliced", "amount": "1", "unit": "lbs" },
      { "name": "chicken or vegetable broth, warm", "amount": "5", "unit": "cups" },
      { "name": "dry white wine", "amount": "0.5", "unit": "cups" },
      { "name": "parmesan cheese, grated", "amount": "0.5", "unit": "cups" }
    ],
    "steps": [
      "Sauté mushrooms in butter until browned, then remove from the pan and set aside.",
      "In the same pan, toast the Arborio rice for 2 minutes. Pour in the wine and stir until absorbed.",
      "Add warm broth one ladle at a time, stirring constantly until the liquid is absorbed before adding more.",
      "Once the rice is tender and creamy (about 25 mins), fold in the cooked mushrooms and parmesan cheese."
    ],
    "notes": "The key to a good risotto is hot broth and constant stirring to release the starches from the rice.",
    "nutrition": { "calories": 380, "protein": 12, "fat": 10, "carbs": 62, "fiber": 3 }
  },
  {
    "title": "Classic Pad Thai",
    "description": "Sweet, tangy, and savory stir-fried rice noodles with shrimp, peanuts, and fresh herbs.",
    "servings": 4,
    "prepTimeMin": 20,
    "cookTimeMin": 15,
    "cuisine": "Thai",
    "difficulty": "medium",
    "ingredients": [
      { "name": "flat rice noodles", "amount": "8", "unit": "oz" },
      { "name": "shrimp, peeled and deveined", "amount": "1", "unit": "lbs" },
      { "name": "eggs", "amount": "2", "unit": "whole" },
      { "name": "bean sprouts", "amount": "2", "unit": "cups" },
      { "name": "roasted peanuts, crushed", "amount": "0.5", "unit": "cups" }
    ],
    "steps": [
      "Soak rice noodles in warm water until pliable but not mushy, then drain.",
      "Whisk together tamarind paste, fish sauce, and brown sugar to make the sauce.",
      "In a hot wok, scramble the eggs and cook the shrimp until just pink.",
      "Add noodles and sauce to the wok, tossing vigorously until the sauce is absorbed.",
      "Fold in bean sprouts and top with crushed peanuts before serving."
    ],
    "notes": "A squeeze of fresh lime juice right before eating balances the sweetness perfectly.",
    "nutrition": { "calories": 420, "protein": 26, "fat": 14, "carbs": 52, "fiber": 4 }
  },
  {
    "title": "Fresh Caprese Salad",
    "description": "A simple, elegant Italian salad showcasing fresh tomatoes, mozzarella, and basil.",
    "servings": 4,
    "prepTimeMin": 10,
    "cookTimeMin": 0,
    "cuisine": "Italian",
    "difficulty": "easy",
    "ingredients": [
      { "name": "ripe heirloom tomatoes", "amount": "3", "unit": "large" },
      { "name": "fresh mozzarella", "amount": "8", "unit": "oz" },
      { "name": "fresh basil leaves", "amount": "1", "unit": "cup" },
      { "name": "extra virgin olive oil", "amount": "3", "unit": "tbsp" },
      { "name": "balsamic glaze", "amount": "2", "unit": "tbsp" }
    ],
    "steps": [
      "Slice the tomatoes and fresh mozzarella into 1/4-inch thick rounds.",
      "Arrange the tomato and mozzarella slices on a platter, alternating them and tucking basil leaves in between.",
      "Sprinkle generously with flaky sea salt and freshly cracked black pepper.",
      "Drizzle the olive oil and balsamic glaze over the top just before serving."
    ],
    "notes": "Because this recipe is so simple, the quality of your tomatoes and olive oil will make or break the dish.",
    "nutrition": { "calories": 250, "protein": 12, "fat": 18, "carbs": 8, "fiber": 2 }
  },
  {
    "title": "Beef Stroganoff",
    "description": "Tender strips of beef and earthy mushrooms in a rich, tangy sour cream sauce served over egg noodles.",
    "servings": 4,
    "prepTimeMin": 15,
    "cookTimeMin": 25,
    "cuisine": "European",
    "difficulty": "medium",
    "ingredients": [
      { "name": "sirloin steak, thinly sliced", "amount": "1.5", "unit": "lbs" },
      { "name": "cremini mushrooms, sliced", "amount": "8", "unit": "oz" },
      { "name": "beef broth", "amount": "1.5", "unit": "cups" },
      { "name": "sour cream", "amount": "0.75", "unit": "cups" },
      { "name": "egg noodles", "amount": "12", "unit": "oz" }
    ],
    "steps": [
      "Quickly sear the beef strips in a hot skillet with oil until browned, then remove and set aside.",
      "In the same skillet, sauté mushrooms and onions until soft.",
      "Sprinkle flour over the vegetables, stir, and slowly whisk in the beef broth to create a gravy.",
      "Return the beef to the pan, remove from heat, and stir in the sour cream.",
      "Serve immediately over cooked egg noodles."
    ],
    "notes": "Never boil the sauce after adding the sour cream, or it will curdle.",
    "nutrition": { "calories": 580, "protein": 42, "fat": 24, "carbs": 48, "fiber": 3 }
  },
  {
    "title": "Sizzling Chicken Fajitas",
    "description": "Marinated chicken breast seared with colorful bell peppers and onions.",
    "servings": 4,
    "prepTimeMin": 20,
    "cookTimeMin": 15,
    "cuisine": "Mexican",
    "difficulty": "easy",
    "ingredients": [
      { "name": "chicken breast, sliced", "amount": "1.5", "unit": "lbs" },
      { "name": "bell peppers, sliced", "amount": "3", "unit": "whole" },
      { "name": "red onion, sliced", "amount": "1", "unit": "whole" },
      { "name": "fajita seasoning", "amount": "2", "unit": "tbsp" },
      { "name": "flour tortillas", "amount": "8", "unit": "whole" }
    ],
    "steps": [
      "Toss the chicken slices with oil and fajita seasoning. Let marinate for 15 minutes.",
      "Heat a large cast-iron skillet over high heat until smoking.",
      "Add the chicken in an even layer and sear undisturbed for 3 minutes, then toss.",
      "Add the onions and peppers, cooking until they are blistered and softened.",
      "Serve hot with warm tortillas, guacamole, and salsa."
    ],
    "notes": "A squeeze of fresh lime juice over the pan right before serving deglazes the pan and adds a bright flavor.",
    "nutrition": { "calories": 460, "protein": 38, "fat": 12, "carbs": 45, "fiber": 6 }
  },
  {
    "title": "Lemon Garlic Butter Shrimp",
    "description": "Succulent shrimp cooked in a rich, garlicky butter sauce with a burst of fresh lemon.",
    "servings": 4,
    "prepTimeMin": 10,
    "cookTimeMin": 10,
    "cuisine": "American",
    "difficulty": "easy",
    "ingredients": [
      { "name": "large shrimp, peeled", "amount": "1.5", "unit": "lbs" },
      { "name": "unsalted butter", "amount": "4", "unit": "tbsp" },
      { "name": "garlic, minced", "amount": "5", "unit": "cloves" },
      { "name": "lemon juice", "amount": "2", "unit": "tbsp" },
      { "name": "fresh parsley, chopped", "amount": "0.25", "unit": "cups" }
    ],
    "steps": [
      "Melt 2 tablespoons of butter in a large skillet over medium heat.",
      "Add the minced garlic and sauté for about 1 minute until fragrant.",
      "Add the shrimp in an even layer and cook for 1-2 minutes per side until pink and opaque.",
      "Stir in the remaining butter, lemon juice, and parsley, tossing to coat. Serve immediately."
    ],
    "notes": "Serve over pasta, rice, or with crusty bread to soak up the delicious garlic butter sauce.",
    "nutrition": { "calories": 280, "protein": 24, "fat": 16, "carbs": 4, "fiber": 0 }
  },
  {
    "title": "Authentic Margherita Pizza",
    "description": "A classic Neapolitan pizza with a thin, blistered crust, sweet San Marzano tomatoes, and fresh mozzarella.",
    "servings": 2,
    "prepTimeMin": 20,
    "cookTimeMin": 10,
    "cuisine": "Italian",
    "difficulty": "medium",
    "ingredients": [
      { "name": "pizza dough", "amount": "1", "unit": "lbs" },
      { "name": "San Marzano tomatoes, crushed", "amount": "0.5", "unit": "cups" },
      { "name": "fresh mozzarella", "amount": "4", "unit": "oz" },
      { "name": "fresh basil", "amount": "0.25", "unit": "cups" },
      { "name": "extra virgin olive oil", "amount": "1", "unit": "tbsp" }
    ],
    "steps": [
      "Preheat your oven and a pizza stone to the highest possible temperature (500°F+).",
      "Stretch the dough into a 10-inch circle on a floured peel.",
      "Spread a thin layer of crushed tomatoes over the dough, leaving a 1-inch border.",
      "Tear the mozzarella into bite-sized pieces and scatter them over the sauce.",
      "Bake until the crust is blistered and cheese is melted. Top with fresh basil and olive oil immediately after baking."
    ],
    "notes": "Less is more with authentic Italian pizza. Overloading it with cheese or sauce will result in a soggy crust.",
    "nutrition": { "calories": 650, "protein": 24, "fat": 22, "carbs": 85, "fiber": 4 }
  },
  {
    "title": "Beef and Broccoli Stir Fry",
    "description": "A takeout classic made at home with tender strips of beef and crisp broccoli in a savory garlic-ginger sauce.",
    "servings": 4,
    "prepTimeMin": 15,
    "cookTimeMin": 10,
    "cuisine": "Asian",
    "difficulty": "easy",
    "ingredients": [
      { "name": "flank steak, thinly sliced", "amount": "1", "unit": "lbs" },
      { "name": "broccoli florets", "amount": "4", "unit": "cups" },
      { "name": "soy sauce", "amount": "0.33", "unit": "cups" },
      { "name": "brown sugar", "amount": "2", "unit": "tbsp" },
      { "name": "cornstarch", "amount": "1", "unit": "tbsp" }
    ],
    "steps": [
      "Whisk together soy sauce, brown sugar, cornstarch, and a splash of water to make the sauce.",
      "Heat oil in a wok over high heat and sear the beef strips until browned, then remove.",
      "Add broccoli and a splash of water to the wok, cover, and steam for 3 minutes.",
      "Return beef to the wok, pour in the sauce, and toss continuously until the sauce thickens and coats everything."
    ],
    "notes": "Slicing the flank steak against the grain is crucial for tender meat.",
    "nutrition": { "calories": 320, "protein": 30, "fat": 14, "carbs": 18, "fiber": 4 }
  },
  {
    "title": "Traditional French Onion Soup",
    "description": "Deeply caramelized onions in a rich beef broth, topped with a crusty baguette slice and melted Gruyère cheese.",
    "servings": 4,
    "prepTimeMin": 15,
    "cookTimeMin": 60,
    "cuisine": "French",
    "difficulty": "hard",
    "ingredients": [
      { "name": "yellow onions, sliced", "amount": "3", "unit": "lbs" },
      { "name": "unsalted butter", "amount": "4", "unit": "tbsp" },
      { "name": "beef broth", "amount": "6", "unit": "cups" },
      { "name": "Gruyère cheese, grated", "amount": "8", "unit": "oz" },
      { "name": "baguette slices, toasted", "amount": "4", "unit": "slices" }
    ],
    "steps": [
      "Melt butter in a large pot over medium heat. Add onions and cook slowly for 45 minutes until deeply browned and caramelized.",
      "Deglaze the pot with a splash of dry wine or water, scraping up the browned bits.",
      "Add the beef broth, bring to a simmer, and cook for another 15 minutes.",
      "Ladle soup into oven-safe bowls, top with a toasted baguette slice, and cover generously with cheese.",
      "Broil until the cheese is bubbling and golden brown."
    ],
    "notes": "Patience is key! Do not rush caramelizing the onions, as this is where all the flavor comes from.",
    "nutrition": { "calories": 410, "protein": 22, "fat": 24, "carbs": 30, "fiber": 4 }
  },
  {
    "title": "Chunky Tableside Guacamole",
    "description": "Fresh, vibrant, and chunky guacamole made exactly how they do it in authentic Mexican restaurants.",
    "servings": 6,
    "prepTimeMin": 10,
    "cookTimeMin": 0,
    "cuisine": "Mexican",
    "difficulty": "easy",
    "ingredients": [
      { "name": "ripe Hass avocados", "amount": "3", "unit": "whole" },
      { "name": "white onion, finely diced", "amount": "0.5", "unit": "cups" },
      { "name": "jalapeño, minced", "amount": "1", "unit": "whole" },
      { "name": "fresh cilantro, chopped", "amount": "0.25", "unit": "cups" },
      { "name": "lime juice", "amount": "2", "unit": "tbsp" }
    ],
    "steps": [
      "Halve the avocados, remove the pits, and scoop the flesh into a large bowl.",
      "Add the onion, jalapeño, cilantro, lime juice, and a generous pinch of salt.",
      "Using a fork or potato masher, gently fold and mash the ingredients together, leaving plenty of chunks.",
      "Taste and adjust salt or lime juice as needed. Serve immediately with tortilla chips."
    ],
    "notes": "Keep the pits in the leftover guacamole and wrap it tightly with plastic wrap touching the surface to prevent browning.",
    "nutrition": { "calories": 160, "protein": 2, "fat": 15, "carbs": 9, "fiber": 7 }
  },
  {
    "title": "Classic Shrimp Scampi",
    "description": "Plump shrimp tossed in a bright, buttery, garlic and white wine sauce served over linguine.",
    "servings": 4,
    "prepTimeMin": 10,
    "cookTimeMin": 15,
    "cuisine": "Italian",
    "difficulty": "easy",
    "ingredients": [
      { "name": "linguine pasta", "amount": "12", "unit": "oz" },
      { "name": "large shrimp, peeled and deveined", "amount": "1", "unit": "lbs" },
      { "name": "garlic, minced", "amount": "4", "unit": "cloves" },
      { "name": "dry white wine", "amount": "0.5", "unit": "cups" },
      { "name": "butter", "amount": "4", "unit": "tbsp" }
    ],
    "steps": [
      "Boil the linguine in salted water until al dente.",
      "While pasta cooks, melt half the butter in a skillet. Add garlic and cook until fragrant.",
      "Add the shrimp and cook until just pink. Remove shrimp and set aside.",
      "Pour the wine into the skillet and simmer until reduced by half. Stir in the remaining butter.",
      "Toss the pasta and shrimp in the sauce, garnish with parsley and a squeeze of lemon, and serve."
    ],
    "notes": "A dry, crisp white wine like Pinot Grigio or Sauvignon Blanc works best for this sauce.",
    "nutrition": { "calories": 480, "protein": 28, "fat": 16, "carbs": 55, "fiber": 3 }
  },
  {
    "title": "Crispy Falafel Wraps",
    "description": "Golden, herby chickpea fritters wrapped in warm pita with fresh veggies and a drizzle of tahini sauce.",
    "servings": 4,
    "prepTimeMin": 20,
    "cookTimeMin": 15,
    "cuisine": "Middle Eastern",
    "difficulty": "medium",
    "ingredients": [
      { "name": "dried chickpeas (soaked overnight)", "amount": "1", "unit": "cup" },
      { "name": "fresh parsley", "amount": "1", "unit": "cup" },
      { "name": "garlic", "amount": "4", "unit": "cloves" },
      { "name": "ground cumin", "amount": "1", "unit": "tbsp" },
      { "name": "pita breads", "amount": "4", "unit": "whole" }
    ],
    "steps": [
      "Drain the soaked chickpeas and pulse them in a food processor with parsley, garlic, cumin, and salt until it forms a coarse meal.",
      "Form the mixture into small balls or patties.",
      "Fry in hot oil (350°F) until deep golden brown and crispy on the outside.",
      "Stuff pita breads with falafel, shredded lettuce, diced tomatoes, and drizzle generously with tahini sauce."
    ],
    "notes": "Do not use canned chickpeas! They are too soft and your falafel will fall apart in the oil.",
    "nutrition": { "calories": 450, "protein": 15, "fat": 18, "carbs": 60, "fiber": 12 }
  },
  {
    "title": "Slow Cooker BBQ Pulled Pork",
    "description": "Melt-in-your-mouth tender pork shoulder, slow-cooked in spices and tossed in tangy barbecue sauce.",
    "servings": 8,
    "prepTimeMin": 15,
    "cookTimeMin": 480,
    "cuisine": "American",
    "difficulty": "easy",
    "ingredients": [
      { "name": "pork shoulder (butt)", "amount": "4", "unit": "lbs" },
      { "name": "brown sugar", "amount": "0.25", "unit": "cups" },
      { "name": "smoked paprika", "amount": "1", "unit": "tbsp" },
      { "name": "apple cider vinegar", "amount": "0.5", "unit": "cups" },
      { "name": "barbecue sauce", "amount": "1.5", "unit": "cups" }
    ],
    "steps": [
      "Mix brown sugar, paprika, salt, and pepper. Rub heavily all over the pork shoulder.",
      "Place the pork in a slow cooker and pour the apple cider vinegar around the base.",
      "Cook on Low for 8 hours until the meat easily pulls apart with a fork.",
      "Remove the pork, shred it discarding any large pieces of fat, and return to the pot.",
      "Stir in the barbecue sauce and let warm through before serving on brioche buns."
    ],
    "notes": "For a smokier flavor, add a teaspoon of liquid smoke to the slow cooker.",
    "nutrition": { "calories": 420, "protein": 35, "fat": 22, "carbs": 20, "fiber": 1 }
  },
  {
    "title": "Teriyaki Glazed Salmon",
    "description": "Flaky salmon fillets baked in a sweet and savory homemade teriyaki glaze.",
    "servings": 2,
    "prepTimeMin": 10,
    "cookTimeMin": 15,
    "cuisine": "Japanese",
    "difficulty": "easy",
    "ingredients": [
      { "name": "salmon fillets", "amount": "2", "unit": "whole" },
      { "name": "soy sauce", "amount": "0.25", "unit": "cups" },
      { "name": "mirin", "amount": "2", "unit": "tbsp" },
      { "name": "honey", "amount": "1", "unit": "tbsp" },
      { "name": "sesame seeds", "amount": "1", "unit": "tsp" }
    ],
    "steps": [
      "In a small saucepan, simmer soy sauce, mirin, and honey until it thickens slightly into a glaze.",
      "Place salmon fillets on a lined baking sheet and brush generously with the glaze.",
      "Bake at 400°F for 12-15 minutes, until the salmon flakes easily with a fork.",
      "Garnish with sesame seeds and sliced green onions. Serve over steamed rice."
    ],
    "notes": "If the glaze isn't thickening, add a tiny pinch of cornstarch mixed with cold water.",
    "nutrition": { "calories": 380, "protein": 34, "fat": 18, "carbs": 15, "fiber": 0 }
  },
  {
    "title": "Classic Eggplant Parmesan",
    "description": "Layers of crispy breaded eggplant, rich marinara sauce, and gooey melted cheese baked to perfection.",
    "servings": 6,
    "prepTimeMin": 30,
    "cookTimeMin": 45,
    "cuisine": "Italian",
    "difficulty": "medium",
    "ingredients": [
      { "name": "eggplants, sliced into rounds", "amount": "2", "unit": "medium" },
      { "name": "panko breadcrumbs", "amount": "2", "unit": "cups" },
      { "name": "marinara sauce", "amount": "3", "unit": "cups" },
      { "name": "mozzarella cheese, shredded", "amount": "2", "unit": "cups" },
      { "name": "parmesan cheese, grated", "amount": "0.5", "unit": "cups" }
    ],
    "steps": [
      "Salt the eggplant slices and let them sit for 20 minutes to draw out moisture. Pat dry.",
      "Dip the slices in beaten egg, then coat in panko breadcrumbs. Fry until golden and crispy.",
      "In a baking dish, spread a thin layer of marinara. Add a layer of crispy eggplant, more sauce, and mozzarella.",
      "Repeat the layers, finishing with plenty of cheese on top.",
      "Bake at 375°F for 25-30 minutes until bubbling and golden."
    ],
    "notes": "Salting the eggplant is a vital step—it removes bitterness and prevents the dish from becoming watery.",
    "nutrition": { "calories": 420, "protein": 18, "fat": 20, "carbs": 44, "fiber": 8 }
  },
  {
    "title": "Spicy Middle Eastern Shakshuka",
    "description": "Eggs poached directly in a hearty, spiced tomato and bell pepper sauce.",
    "servings": 3,
    "prepTimeMin": 10,
    "cookTimeMin": 25,
    "cuisine": "Middle Eastern",
    "difficulty": "easy",
    "ingredients": [
      { "name": "eggs", "amount": "6", "unit": "whole" },
      { "name": "crushed tomatoes", "amount": "28", "unit": "oz" },
      { "name": "red bell pepper, diced", "amount": "1", "unit": "whole" },
      { "name": "smoked paprika", "amount": "1", "unit": "tsp" },
      { "name": "cumin", "amount": "1", "unit": "tsp" }
    ],
    "steps": [
      "Sauté onions and bell peppers in a large skillet until soft.",
      "Stir in garlic, paprika, and cumin, cooking for 1 minute until fragrant.",
      "Pour in the crushed tomatoes, season with salt, and simmer for 15 minutes to thicken.",
      "Make small wells in the sauce using a spoon and crack an egg into each well.",
      "Cover and cook for 5-8 minutes until the egg whites are set but yolks are still runny. Serve with crusty bread."
    ],
    "notes": "Feta cheese crumbles and fresh cilantro make the perfect garnish.",
    "nutrition": { "calories": 240, "protein": 14, "fat": 12, "carbs": 18, "fiber": 4 }
  },
  {
    "title": "Grilled Chicken Caesar Salad",
    "description": "Crisp romaine lettuce tossed in a creamy, garlicky homemade dressing, topped with grilled chicken and croutons.",
    "servings": 2,
    "prepTimeMin": 15,
    "cookTimeMin": 15,
    "cuisine": "American",
    "difficulty": "easy",
    "ingredients": [
      { "name": "chicken breast", "amount": "1", "unit": "lbs" },
      { "name": "romaine lettuce hearts, chopped", "amount": "2", "unit": "whole" },
      { "name": "parmesan cheese, shaved", "amount": "0.33", "unit": "cups" },
      { "name": "croutons", "amount": "1", "unit": "cup" },
      { "name": "Caesar dressing", "amount": "0.25", "unit": "cups" }
    ],
    "steps": [
      "Season the chicken breast with salt, pepper, and garlic powder. Grill until cooked through, then slice.",
      "In a large bowl, toss the chopped romaine lettuce with the Caesar dressing until evenly coated.",
      "Add the croutons and shaved parmesan, tossing gently.",
      "Divide the salad onto plates and top with the sliced grilled chicken."
    ],
    "notes": "For the best flavor, make your dressing from scratch using anchovy paste, garlic, lemon, and egg yolks.",
    "nutrition": { "calories": 450, "protein": 42, "fat": 24, "carbs": 16, "fiber": 3 }
  },
  {
    "title": "Authentic Pho Bo (Beef Noodle Soup)",
    "description": "A fragrant Vietnamese soup featuring a long-simmered spiced beef bone broth, rice noodles, and thinly sliced beef.",
    "servings": 6,
    "prepTimeMin": 30,
    "cookTimeMin": 240,
    "cuisine": "Vietnamese",
    "difficulty": "hard",
    "ingredients": [
      { "name": "beef marrow bones", "amount": "3", "unit": "lbs" },
      { "name": "star anise", "amount": "4", "unit": "whole" },
      { "name": "cinnamon stick", "amount": "1", "unit": "whole" },
      { "name": "flat rice noodles", "amount": "1", "unit": "lbs" },
      { "name": "beef sirloin, sliced paper thin", "amount": "1", "unit": "lbs" }
    ],
    "steps": [
      "Parboil the beef bones for 10 minutes, then rinse them clean to ensure a clear broth.",
      "Char the onions and ginger over an open flame until blackened, then peel.",
      "Simmer the bones, charred aromatics, and toasted spices (star anise, cinnamon) in water for at least 4 hours.",
      "Strain the broth and season with fish sauce and rock sugar.",
      "Place cooked noodles and raw beef slices in a bowl. Pour the boiling hot broth over the beef to cook it instantly."
    ],
    "notes": "Serve with a side plate of bean sprouts, Thai basil, jalapeño, and lime wedges.",
    "nutrition": { "calories": 520, "protein": 36, "fat": 15, "carbs": 62, "fiber": 2 }
  },
  {
    "title": "Chewy Chocolate Chip Cookies",
    "description": "The ultimate comfort bake: cookies with crispy edges, a soft, chewy center, and pools of melted chocolate.",
    "servings": 24,
    "prepTimeMin": 15,
    "cookTimeMin": 12,
    "cuisine": "American",
    "difficulty": "easy",
    "ingredients": [
      { "name": "all-purpose flour", "amount": "2.25", "unit": "cups" },
      { "name": "butter, softened", "amount": "1", "unit": "cup" },
      { "name": "brown sugar", "amount": "0.75", "unit": "cups" },
      { "name": "semi-sweet chocolate chips", "amount": "2", "unit": "cups" },
      { "name": "eggs", "amount": "2", "unit": "whole" }
    ],
    "steps": [
      "Preheat oven to 375°F. Cream together the softened butter, brown sugar, and white sugar until light and fluffy.",
      "Beat in the eggs one at a time, then stir in a splash of vanilla extract.",
      "In a separate bowl, mix the flour, baking soda, and salt. Gradually blend this dry mixture into the wet ingredients.",
      "Fold in the chocolate chips, then drop tablespoon-sized mounds of dough onto ungreased baking sheets.",
      "Bake for 10-12 minutes until edges are golden. Let cool on the pan for 2 minutes before transferring to wire racks."
    ],
    "notes": "For thicker, chewier cookies, chill the dough in the refrigerator for at least 1 hour before baking.",
    "nutrition": { "calories": 180, "protein": 2, "fat": 9, "carbs": 24, "fiber": 1 }
  },
  {
    "title": "Indian Butter Chicken",
    "description": "Tender chicken pieces marinated in yogurt and spices, simmered in a rich, mildly spiced tomato cream sauce.",
    "servings": 4,
    "prepTimeMin": 30,
    "cookTimeMin": 30,
    "cuisine": "Indian",
    "difficulty": "medium",
    "ingredients": [
      { "name": "chicken thighs, boneless/skinless", "amount": "1.5", "unit": "lbs" },
      { "name": "plain yogurt", "amount": "0.5", "unit": "cups" },
      { "name": "tomato puree", "amount": "1.5", "unit": "cups" },
      { "name": "heavy cream", "amount": "0.5", "unit": "cups" },
      { "name": "garam masala", "amount": "1", "unit": "tbsp" }
    ],
    "steps": [
      "Marinate the chicken in yogurt, lemon juice, garlic, ginger, and half the garam masala for at least 30 minutes.",
      "Sear the chicken pieces in a large skillet until browned, then remove them.",
      "In the same skillet, melt butter and cook down the tomato puree with the remaining spices.",
      "Stir in the heavy cream and return the chicken to the pan. Simmer for 10 minutes until thick and creamy.",
      "Serve hot with warm naan bread and basmati rice."
    ],
    "notes": "Don't skip the marinating step; the yogurt acid tenderizes the chicken beautifully.",
    "nutrition": { "calories": 540, "protein": 32, "fat": 38, "carbs": 14, "fiber": 3 }
  },
  {
    "title": "Caprese Panini",
    "description": "A warm, pressed Italian sandwich filled with fresh mozzarella, juicy tomatoes, and vibrant pesto.",
    "servings": 2,
    "prepTimeMin": 5,
    "cookTimeMin": 8,
    "cuisine": "Italian",
    "difficulty": "easy",
    "ingredients": [
      { "name": "ciabatta bread", "amount": "2", "unit": "rolls" },
      { "name": "fresh mozzarella", "amount": "4", "unit": "oz" },
      { "name": "tomato", "amount": "1", "unit": "whole" },
      { "name": "basil pesto", "amount": "2", "unit": "tbsp" },
      { "name": "butter", "amount": "1", "unit": "tbsp" }
    ],
    "steps": [
      "Slice the ciabatta rolls in half. Spread pesto generously on the inside of both halves.",
      "Layer thick slices of fresh mozzarella and tomato inside the roll.",
      "Butter the outside of the sandwich lightly.",
      "Grill in a panini press or a heavy skillet (weighted down with another pan) until the bread is crusty and the cheese melts.",
      "Cut in half and serve warm."
    ],
    "notes": "A drizzle of balsamic glaze inside the sandwich takes it to the next level.",
    "nutrition": { "calories": 410, "protein": 16, "fat": 22, "carbs": 38, "fiber": 3 }
  }
]

export type RecipeInput = typeof recipes[0]

export function buildRawText(r: RecipeInput): string {
  return [
    `# ${r.title}`,
    `\n${r.description}`,
    `\n## Ingredients`,
    r.ingredients.map(i => `- ${i.amount} ${i.unit} ${i.name}`).join('\n'),
    `\n## Instructions`,
    r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    r.notes ? `\n## Notes\n${r.notes}` : '',
  ].join('\n')
}

export function buildRecipeRecord(r: RecipeInput, userId: string) {
  return {
    userId,
    title: r.title,
    description: r.description,
    servings: r.servings,
    prepTimeMin: r.prepTimeMin,
    cookTimeMin: r.cookTimeMin,
    cuisine: r.cuisine,
    difficulty: r.difficulty,
    sourceIngredients: r.ingredients.map(i => i.name),
    recipeData: r,
    rawText: buildRawText(r),
    nutrition: r.nutrition,
  }
}

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: 'cedarbarrett@gmail.com' } })
  if (!admin) throw new Error('Admin user not found — run seed-admin-user.ts first')

  let created = 0
  for (const r of recipes) {
    await prisma.recipe.create({ data: buildRecipeRecord(r, admin.id) })
    console.log(`✓ ${r.title}`)
    created++
  }

  console.log(`\nDone — ${created} recipes seeded.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
