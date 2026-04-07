# IngredientBot — Feature Index

## ✅ Built
- ✅ Split-panel kitchen at `/kitchen`
- ✅ AI recipe generation (claude-sonnet-4-6 for recipes, claude-haiku-4-5 for ingredient comments)
- ✅ Recipe detail pages with structured data (ingredients, steps, nutrition, modifications)
- ✅ Photo-based recipe analysis
- ✅ Recipe modification system + modification toolbar
- ✅ Saved recipes collection
- ✅ Meal planner with weekly slots
- ✅ Grocery list sheet (generated from recipes)
- ✅ Recipe search and filtering
- ✅ Dashboard
- ✅ Settings page
- ✅ Admin panel (users, audit logs, scripts, AI debug)
- ✅ Auth (credentials-only, public signup, email verification, password reset)
- ✅ Email system (welcome, verify, password reset via ZeptoMail)
- ✅ Welcome drip cron job
- ✅ Error boundary, loading skeleton, rate limiting
- ✅ Cookie consent banner + Plausible analytics
- ✅ Notification preferences (marketing, product)
- ✅ Sign out all devices
- ✅ Email change flow
- ✅ Audit logging
- ✅ Health check API
- ✅ Sitemap + robots.txt + OpenGraph image

## 🛠 Planned / In Progress
- 🛠 Smart Ingredient Substitution Engine
- 🛠 Dietary Restriction Auto-Converter
- 🛠 Cuisine Fusion Remix
- 🛠 Cooking Skill Calibration
- 🛠 Flavor Profile Learning
- 🛠 "What's Going Bad First" Priority Mode
- 🛠 AI Cooking Coach Chat
- 🛠 Recipe Scaling Intelligence
- 🛠 Full Macro & Micronutrient Breakdown
- 🛠 Daily Nutrition Dashboard
- 🛠 Goal-Based Meal Plan Generation
- 🛠 Allergy & Intolerance Safety Alerts
- 🛠 Health Condition Meal Plans
- 🛠 Smart Grocery List Aggregation
- 🛠 Persistent Digital Pantry
- 🛠 Grocery Delivery Integration (Instacart API)
- 🛠 Price Estimation & Budget Tracking
- 🛠 Barcode Scanner for Pantry
- 🛠 Grocery List Sharing
- 🛠 Hands-Free Voice Cook Mode
- 🛠 Built-In Cooking Timers
- 🛠 Step-by-Step Cook View
- 🛠 Cook & Rate Feedback Loop
- 🛠 Recipe Print & Export
- 🛠 Cooking Unit Converter
- 🛠 Video & Image Step Illustrations
- 🛠 Auto-Fill Weekly Meal Plan
- 🛠 Leftover & Batch Cooking Intelligence
- 🛠 Recipe Collections & Tags
- 🛠 Seasonal & Local Ingredient Suggestions
- 🛠 Meal Prep Sunday Mode
- 🛠 Calendar Sync
- 🛠 Public Recipe Sharing
- 🛠 Recipe Import from URL
- 🛠 Household & Family Accounts
- 🛠 Community Recipe Feed
- 🛠 Photo Gallery of Cooked Meals
- 🛠 Recipe Collaboration
- 🛠 Premium Subscription Tier
- 🛠 Referral System
- 🛠 2FA (TOTP)
- 🛠 Onboarding Flow
- 🛠 Email Re-Engagement Campaign
- 🛠 SEO Recipe Pages
- 🛠 PWA & Offline Support
- 🛠 Smart Appliance Integration
- 🛠 Apple Health / Google Fit Sync
- 🛠 Chrome Extension for Recipe Import
- 🛠 Recipe Generation Analytics Dashboard
- 🛠 User Retention Cohort Analysis

---

## Core App

- ✅ **Split-panel kitchen at `/kitchen`** — Ingredient input + streaming AI recipe suggestions. The primary entry point: left panel accepts a free-form list of ingredients, right panel streams a generated recipe in real time.

- ✅ **AI recipe generation** — claude-sonnet-4-6 for full recipes, claude-haiku-4-5 for per-ingredient comments (quick, cheap responses). Two-model strategy balances quality vs. latency/cost.

- ✅ **Recipe detail pages** — Structured data display: ingredients list, step-by-step instructions, nutrition estimate, prep/cook time, and a modifications panel.

- ✅ **Photo-based recipe analysis** — `POST /api/recipes/analyze-photo` accepts an image upload and uses Claude vision to identify ingredients and suggest matching recipes.

- ✅ **Recipe modification system** — `POST /api/recipes/[id]/modify` + a toolbar on the recipe page for one-click modifications (make it vegan, double the servings, simplify for beginners, etc.). Modifications stored as a JSON array on the Recipe model.

- ✅ **Saved recipes collection** — `/saved` page listing all recipes the user has saved, with search and filter.

- ✅ **Meal planner with weekly slots** — `/meal-plan` calendar grid where users assign saved recipes to breakfast/lunch/dinner slots for each day of the week.

- ✅ **Grocery list sheet** — Auto-generated ingredient list from the active meal plan. Rendered as a checklist sheet.

- ✅ **Recipe search and filtering** — Search across saved recipes by name, cuisine, dietary tags, or ingredients used.

- ✅ **Dashboard** — `/dashboard` landing after login: quick stats, recent recipes, meal plan preview, and shortcut to the kitchen.

- ✅ **Settings page** — `/settings` with account management: profile info, notification prefs, email change, sign out all devices, 2FA (once built), delete account.

- ✅ **Admin panel** — Admin-only routes for user management, audit log viewer, scripts runner, and AI debug (raw prompt/response inspection).

- ✅ **Auth** — Credentials-only public signup, email verification, password reset. No OAuth in MVP.

- ✅ **Email system** — Transactional emails via ZeptoMail: welcome, email verification, password reset.

- ✅ **Welcome drip cron job** — Scheduled email sequence for new signups introducing core features.

- ✅ **Error boundary, loading skeleton, rate limiting** — Global error boundary, per-page skeleton loaders, and API rate limiting on AI endpoints.

- ✅ **Cookie consent banner + Plausible analytics** — EU-aware consent gate using `x-vercel-ip-country`; Plausible is enabled only after consent.

- ✅ **Notification preferences** — Users opt in/out of marketing and product emails. PATCH `/api/user/notifications`.

- ✅ **Sign out all devices** — `sessionsRevokedAt` timestamp approach: invalidates all existing JWTs on demand.

- ✅ **Email change flow** — Three-step flow: request new email → verify via token link → update record. Handles edge cases (token expiry, already-in-use email).

- ✅ **Audit logging** — `AuditLog` model records key security events: login, signup, password reset, password change, email change.

- ✅ **Health check API** — `GET /api/health` returns DB connectivity and uptime. Used by Vercel and monitoring tools.

- ✅ **Sitemap + robots.txt + OpenGraph image** — Static sitemap for public pages, robots.txt, and a custom OG image for social sharing.

---

## AI & Recipe Intelligence

- 🛠 **Smart Ingredient Substitution Engine** — When a user is missing an ingredient, Claude suggests contextual swaps (e.g., Greek yogurt for sour cream, coconut aminos for soy sauce) with adjusted quantities and a note on how it changes the dish. Research shows AI substitution is the #1 requested cooking feature, and apps like SideChef and BigOven have built dedicated substitution tools. Unlike static lookup tables, Claude can reason about the role an ingredient plays (binder, acid, fat) and suggest substitutions that preserve the recipe's chemistry.

- 🛠 **Dietary Restriction Auto-Converter** — One-click conversion of any recipe to meet dietary needs: gluten-free, vegan, keto, dairy-free, nut-free, low-FODMAP, halal, etc. Claude rewrites the full ingredient list and adjusts technique (e.g., different rising time for GF bread). PlateJoy and Eat This Much proved demand for diet-aware meal planning, but no app yet offers real-time AI conversion of arbitrary recipes. This is a natural extension of the existing modification system.

- 🛠 **Cuisine Fusion Remix** — Take any saved recipe and tell Claude to remix it through a different culinary lens (e.g., "make this chicken stir-fry Mexican" or "give this pasta a Japanese twist"). Tasty's Recipe Remixes feature showed that users love seeing creative variations. AI makes this infinitely generative rather than relying on user-submitted variations.

- 🛠 **Cooking Skill Calibration** — During onboarding or in settings, users self-rate their skill level (beginner / intermediate / advanced). Claude adjusts recipe complexity, technique explanations, and vocabulary accordingly. Mealime targets 30-minute beginner recipes; PlateJoy adjusts by skill level. Having Claude dynamically rewrite instructions per skill level is something no competitor does.

- 🛠 **Flavor Profile Learning** — Track which recipes a user saves, cooks, and rates highly to build an implicit taste profile (spice tolerance, sweetness preference, protein leanings, cuisine affinities). Use this profile to bias future recipe generation without requiring explicit configuration. Yummly (before shutdown) and Samsung Food both invested heavily in personalization algorithms. An LLM-powered version can be more nuanced.

- 🛠 **"What's Going Bad First" Priority Mode** — Users can flag ingredients with approximate expiration dates. The kitchen panel prioritizes recipes that use soon-to-expire items first, reducing food waste. SuperCook's core value prop is reducing food waste, but it lacks expiration awareness. This combines SuperCook's ingredient-matching with smart expiry prioritization.

- 🛠 **AI Cooking Coach Chat** — A conversational assistant available on any recipe page where users can ask real-time questions ("Is my dough supposed to look like this?", "Can I skip the resting step?", "What does 'fold in' mean?"). Goes beyond static instructions into interactive guidance. ChatGPT has proven people want to ask cooking questions conversationally, but it lacks recipe context. Embedding the chat directly on the recipe page gives Claude full context of what the user is making.

- 🛠 **Recipe Scaling Intelligence** — Go beyond simple math multiplication for serving adjustment. Claude accounts for non-linear scaling (spices don't double linearly, baking chemistry changes at larger volumes, pan sizes affect cook times). Paprika and CopyMeThat offer basic linear scaling. Intelligent scaling that understands cooking science is a genuine differentiator.

---

## Nutrition & Health

- 🛠 **Full Macro & Micronutrient Breakdown** — Calculate and display detailed nutrition facts for every AI-generated recipe: calories, protein, carbs, fat, fiber, sodium, plus key vitamins and minerals. Present as a visual card matching FDA nutrition label format. Cronometer tracks 84 nutrients; MyFitnessPal has 20M+ foods in its database. Users increasingly expect nutrition data alongside recipes, especially with the rise of GLP-1 medication awareness.

- 🛠 **Daily Nutrition Dashboard** — Aggregate nutrition across all meals in the day's meal plan. Show progress bars for calories, protein, carbs, fat against user-set targets. Highlight deficiencies (low iron, low fiber) and surpluses. Cronometer and MyFitnessPal both center their UX around daily nutrient tracking. Combining this with an AI recipe generator means IngredientBot can suggest recipes that fill nutritional gaps.

- 🛠 **Goal-Based Meal Plan Generation** — Let users set a weekly nutrition goal (cut, bulk, maintain, or specific macro splits like 40/30/30) and have Claude auto-generate a full week of meals that hit those targets while respecting ingredient preferences. Eat This Much's entire business is automated calorie-target meal plans ($60/year). Building this into IngredientBot with Claude's flexibility creates a more personalized version without a separate subscription.

- 🛠 **Allergy & Intolerance Safety Alerts** — Maintain a user profile of allergens and intolerances. Flag any recipe or ingredient that triggers an alert, with clear visual warnings and safe alternatives. Samsung Food and Mealime both support allergy filtering, but they only filter search results. A smarter approach warns in real-time during recipe generation and modification.

- 🛠 **Health Condition Meal Plans** — Pre-built and AI-customizable meal plan templates for common health goals: diabetes-friendly (low glycemic), heart-healthy (low sodium/saturated fat), anti-inflammatory, PCOS-friendly, pregnancy nutrition, post-surgery recovery. PlateJoy offers diabetes and heart-health meal plans as a premium differentiator. AI can generate condition-specific plans that are far more personalized than static templates.

---

## Grocery & Shopping

- 🛠 **Smart Grocery List Aggregation** — Combine grocery lists from multiple recipes in the week's meal plan into a single consolidated list. Automatically merge duplicate ingredients (1 cup milk + 2 cups milk = 3 cups milk), group by store aisle/section (produce, dairy, pantry, frozen), and subtract items already in the user's pantry. Samsung Food, Paprika, and Mealime all auto-generate organized shopping lists. This is table stakes for meal planning apps.

- 🛠 **Persistent Digital Pantry** — A pantry inventory where users track what they have at home. When generating recipes or grocery lists, IngredientBot checks the pantry and skips items the user already owns. Items are auto-deducted when a recipe is marked as "cooked." Eat This Much's pantry feature prioritizes using what you own. Paprika's pantry prevents redundant purchases. This bridges the gap between meal planning and actual kitchen reality.

- 🛠 **Grocery Delivery Integration (Instacart API)** — One-click "Order Ingredients" button on any recipe or grocery list that sends items to Instacart for same-day delivery. Instacart's Developer Platform already powers this for NYT Cooking, WeightWatchers, and GE Appliances. Mealime integrates with Instacart, Amazon Fresh, Kroger, and Walmart. This is the highest-impact monetization-adjacent feature for reducing friction from "recipe" to "cooking."

- 🛠 **Price Estimation & Budget Tracking** — Show estimated ingredient costs per recipe and per weekly meal plan using average grocery price data. Let users set a weekly food budget and filter/sort recipes by cost. Eat This Much factors in budget. PlateJoy claims cost savings. In the current economy, cost-conscious meal planning is a top user priority.

- 🛠 **Barcode Scanner for Pantry** — Use the device camera to scan product barcodes and instantly add items to the digital pantry with correct names and quantities. Cronometer and MyFitnessPal both use barcode scanning as a core input method. Removes the friction of manually typing every pantry item.

- 🛠 **Grocery List Sharing** — Share a grocery list via link, SMS, or in-app with a household member who can check items off in real-time from their own device. Samsung Food and Paprika both support list sharing. Essential for households where one person plans meals and another shops.

---

## Kitchen & Cooking UX

- 🛠 **Hands-Free Voice Cook Mode** — A dedicated cooking view activated from any recipe that reads steps aloud via speech synthesis, responds to voice commands ("next step," "repeat that," "how much flour?", "set timer 10 minutes"), and keeps the screen awake. Voicipe, Chef Cecil, and BakeSpace's BakeBot all prove demand for voice-guided cooking. Mealime has a wave-to-advance gesture mode. This is the killer UX feature that transforms a recipe app into a cooking companion.

- 🛠 **Built-In Cooking Timers** — Detect time references in recipe steps ("simmer for 20 minutes," "bake at 375F for 45 minutes") and surface tap-to-start timers. Multiple simultaneous timers for complex recipes with labels (e.g., "pasta water," "sauce reduction"). Paprika auto-detects timers in recipe directions. Samsung Food's Smart Cooking Mode includes guided timers. Timer support is one of the most-requested features in recipe app reviews.

- 🛠 **Step-by-Step Cook View** — A full-screen, one-step-at-a-time cooking interface with large text, the relevant ingredients for each step highlighted, swipe/tap to advance, and progress indicator. Screen stays awake. Samsung Food's guided cooking mode and Tasty's step-by-step instruction mode both use this pattern. Reduces cognitive load versus scrolling through a long recipe page.

- 🛠 **Cook & Rate Feedback Loop** — After marking a recipe as "cooked," prompt the user to rate it (1-5 stars), note what they'd change, and optionally upload a photo of the result. Ratings feed back into the flavor profile and recipe recommendations. Allrecipes built its entire community on ratings and reviews (30M+ cooks). Tasty's community lets users share photos of their creations. This data makes future AI suggestions better.

- 🛠 **Recipe Print & Export** — Clean print layout for any recipe (no ads, no UI chrome, just ingredients, steps, and optional nutrition). Export as PDF or share via link. CopyMeThat and Paprika both offer print and export. Still essential for users who prefer a physical recipe card on the counter.

- 🛠 **Cooking Unit Converter** — Inline conversion between metric and imperial, plus common kitchen shortcuts (tablespoons to cups, grams to ounces, Celsius to Fahrenheit). Accessible as a toolbar on any recipe page. Paprika includes unit conversion. For a global app, metric/imperial toggling is essential. Claude can also convert between volume and weight measurements for more precise baking.

- 🛠 **Video & Image Step Illustrations** — For AI-generated recipes, generate or source short technique illustrations for tricky steps (how to julienne, how to fold egg whites, what "golden brown" looks like). Initially could use a curated library of technique GIFs/photos. Tasty's overhead cooking videos drove massive engagement. Even static technique images dramatically reduce cooking failures for beginners.

---

## Meal Planning & Organization

- 🛠 **Auto-Fill Weekly Meal Plan** — One-click "Fill My Week" button that uses Claude to generate a balanced 7-day meal plan respecting the user's dietary preferences, nutrition targets, pantry contents, and cooking skill level. The user reviews and can swap individual meals. Eat This Much's automatic meal planner is their entire product ($5/month). PlateJoy charges $69/6 months for AI-generated plans. Building this into IngredientBot makes the meal planner dramatically more useful.

- 🛠 **Leftover & Batch Cooking Intelligence** — When planning meals, Claude factors in recipes that produce leftovers and schedules them as lunch the next day. Suggest batch-cooking sessions (e.g., make a big pot of rice Sunday for 3 dinners). Highlights when a meal plan creates excess of a perishable ingredient and suggests using it elsewhere. Eat This Much integrates leftovers into plans automatically. This is a major pain point for real-world meal planners: nobody wants to cook 21 unique meals per week.

- 🛠 **Recipe Collections & Tags** — Let users create custom collections (Weeknight Dinners, Date Night, Kid-Friendly, Meal Prep) and tag recipes for easy organization. Pre-seed with smart auto-tags based on recipe attributes. CopyMeThat's collections and Paprika's categories are core organizational features. As users accumulate 50+ saved recipes, organization becomes critical.

- 🛠 **Seasonal & Local Ingredient Suggestions** — Based on the user's region and current month, Claude highlights what produce is in season and suggests recipes featuring those ingredients. Promotes better-tasting, cheaper, more sustainable cooking. PlateJoy and farm-to-table movements emphasize seasonal cooking. This is a natural fit for an AI that can reason about seasonality and geography.

- 🛠 **Meal Prep Sunday Mode** — A dedicated view that consolidates a week's worth of recipes into an efficient batch-cooking workflow: shared prep steps (dice all onions at once), optimal cooking order, storage instructions, and reheat notes for each day. Mealime's Pro version targets meal preppers. The meal prep trend continues to grow on social media. Claude can intelligently sequence prep steps for maximum efficiency.

- 🛠 **Calendar Sync** — Export the weekly meal plan to Google Calendar or Apple Calendar as events with recipe links, so users see what they're cooking alongside their schedule. Samsung Food integrates with calendar reminders. Yummly (before shutdown) had cooking start-time reminders. Connecting meal plans to daily routines increases follow-through.

---

## Community & Social

- 🛠 **Public Recipe Sharing** — Generate a shareable public URL for any saved recipe that non-users can view (with a signup CTA). Users can optionally share their modifications and notes. Allrecipes and Tasty are built on shared recipes. CopyMeThat lets users share via link. This creates organic growth while giving users a way to share what they've created.

- 🛠 **Recipe Import from URL** — Paste any recipe URL (from Allrecipes, NYT Cooking, food blogs, etc.) and IngredientBot uses Claude to extract and structure the recipe into the app's format: ingredients, steps, nutrition estimate, prep/cook time. Paprika's browser-based recipe import is its killer feature. CopyMeThat's Chrome extension does the same. Samsung Food saves from any website. This is one of the most-requested features in recipe app reviews. Claude excels at parsing unstructured recipe content.

- 🛠 **Household & Family Accounts** — Multiple user profiles under one household, each with their own dietary preferences and restrictions. The meal planner accounts for everyone's needs (e.g., one person is vegetarian, one is gluten-free). Samsung Food supports family sharing. PlateJoy adjusts portions by household member. Real households have mixed dietary needs that single-user apps ignore.

- 🛠 **Community Recipe Feed** — A discovery feed of recipes created and shared by other IngredientBot users, with upvotes, saves, and cook-count. Filter by trending, newest, cuisine, dietary tags. Allrecipes has 30M+ community members. MyFridgeFood is built entirely on user-submitted recipes. Tasty's community feed drives engagement and retention. This creates a flywheel: more users = more recipes = more value.

- 🛠 **Photo Gallery of Cooked Meals** — A visual journal of everything the user has cooked, displayed as a grid of photos with dates. Shareable as a "cooking portfolio." Satisfying to scroll through and motivating over time. Tasty's community photo sharing and Instagram-style food posting show that people love showing off what they cook. This adds an emotional, visual dimension to the app.

- 🛠 **Recipe Collaboration** — Invite another user to co-edit a recipe, leaving comments on specific steps or ingredients. Useful for families refining a recipe together or friends planning a dinner party. No major recipe app offers real-time collaboration. This is a differentiated social feature that makes IngredientBot useful for cooking as a shared activity.

---

## Monetization & Growth

- 🛠 **Premium Subscription Tier** — Free tier: 10 AI recipe generations/month, basic meal planning, manual grocery list. Premium ($6/month or $49/year): unlimited AI generations, auto-fill meal plans, nutrition tracking, voice cook mode, pantry management, priority AI queue. Samsung Food charges $59.99/year for Food+. Eat This Much is $60/year. Mealime Pro is $2.99/month. The AI generation cost per recipe justifies a subscription model.

- 🛠 **Referral System** — Users earn bonus AI generations or a free premium month for each friend they invite who signs up. Tracked via referral codes and cookies. All portfolio sites use this pattern successfully. Referral programs are the highest-ROI growth channel for consumer apps with network effects.

- 🛠 **2FA (TOTP)** — Two-factor authentication using authenticator apps (Google Authenticator, Authy) via the `otpauth` library, matching the pattern used across the portfolio. Table stakes for user security. All other portfolio sites have 2FA implemented.

- 🛠 **Onboarding Flow** — A 4-step guided setup after signup: (1) dietary preferences and allergies, (2) cooking skill level, (3) household size, (4) first ingredient entry and recipe generation. Reduces time-to-value from signup to first recipe. PlateJoy's onboarding quiz (50+ data points) is their key differentiator. Mealime's 200+ personalization options are set during onboarding. A good onboarding flow dramatically improves retention.

- 🛠 **Email Re-Engagement Campaign** — Automated email sequences for users who haven't visited in 7/14/30 days with personalized recipe suggestions based on their profile and the current season. Weekly "meal plan inspiration" digest for active users. All portfolio sites use drip campaigns. Re-engagement emails are the cheapest retention tool for any SaaS app.

- 🛠 **SEO Recipe Pages** — Public-facing, crawlable recipe pages with JSON-LD structured data (schema.org/Recipe) for Google rich results (cooking time, ratings, nutrition, images). Drives organic traffic from "how to make X" searches. Allrecipes gets 70M+ monthly organic visits from recipe structured data. This is the single highest-leverage SEO feature for a recipe app.

- 🛠 **PWA & Offline Support** — Service worker for offline access to saved recipes and grocery lists. Add-to-homescreen prompt on mobile. Enables cooking from saved recipes without internet (common in kitchens with poor signal). Paprika works fully offline. CopyMeThat syncs offline. Kitchen use cases demand offline reliability because users often cook away from strong WiFi.

---

## Platform & Integrations

- 🛠 **Smart Appliance Integration** — Send cook temperature and time from a recipe directly to connected ovens (Samsung SmartThings, LG ThinQ, Bosch Home Connect) via their APIs. Auto-preheat when the user starts a recipe. Samsung Food's deep integration with Samsung appliances is their competitive moat. The connected kitchen market is projected at 470M devices by 2030. Even basic oven preheat integration is a compelling feature.

- 🛠 **Apple Health / Google Fit Sync** — Export daily nutrition data from logged meals to Apple Health or Google Fit. Import activity data to adjust daily calorie targets (ate less on rest days, more on workout days). Cronometer and MyFitnessPal both sync with health platforms. Eat This Much syncs with Apple Health and Google Fit. Health platform integration keeps nutrition data unified.

- 🛠 **Chrome Extension for Recipe Import** — A browser extension that adds a "Save to IngredientBot" button when visiting any recipe page. One click extracts the recipe using Claude and saves it to the user's collection. CopyMeThat's Chrome extension is their most-loved feature. Paprika has a built-in browser for recipe import. A Chrome extension meets users where they already browse recipes.

---

## Data & Analytics (Admin)

- 🛠 **Recipe Generation Analytics Dashboard** — Admin view showing AI usage metrics: total generations per day/week/month, average generation time, most-requested cuisines, most-used ingredients, failure rates, token usage and cost per recipe. Essential for understanding usage patterns and managing AI costs. No competitor exposes this data because they don't use generative AI for recipe creation.

- 🛠 **User Retention Cohort Analysis** — Admin dashboard showing signup-to-7-day, 30-day, and 90-day retention rates, segmented by acquisition channel, onboarding completion, and feature adoption (saved first recipe, created meal plan, generated grocery list). Standard SaaS analytics that drive product decisions. Understanding which features correlate with retention tells you what to build next.

---

## Infrastructure

- 🛠 **Launch lock** — `LAUNCH_LOCKED=true` gates all non-auth routes behind login until official launch. Remove from Vercel env vars to unlock.
