/**
 * @description AI-generated PUBLIC recipe library seeder. Creates a house library user (library@ingredientbot.com, no password login) and seeds ~1000 public recipes (isPublic + publicSlug) across 50 cuisines (expanded 2026-08-29 from ~400/40). Recipe body, tags (5-8), and nutrition macros (calories/protein/carbs/fat only — no allergen claims) come from one ai-batch generation via DeepSeek V4 Flash on the Azure Foundry ds lane (AZURE_FOUNDRY_* env); allergens/mayContain come from scripts/lib/allergen-verify.ts on the same paid Azure model (single-model as of 2026-08-05 — NOT verified; the allergen disclaimer must render wherever they are shown). Idempotent on publicSlug.
 * @tables users, recipes
 *
 * Usage:
 *   npx tsx scripts/seed-public-recipes-ai.ts               # all ~400 default dishes
 *   npx tsx scripts/seed-public-recipes-ai.ts --count 10    # first 10
 *   npx tsx scripts/seed-public-recipes-ai.ts --dry-run     # print the plan — NO AI calls, NO DB connection
 *
 * --dry-run is deliberately fully offline: the allergen lane must never run as
 * a side effect of a preview.
 *
 * Requires in /home/cedar/Projects/.env:
 *   AZURE_FOUNDRY_RESOURCE + AZURE_FOUNDRY_API_KEY   (recipe generation, ds lane)
 *   AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY     (allergen generation — no free-lane fallback)
 */
import './lib/load-env' // MUST stay first — see scripts/lib/load-env.ts (import hoisting)
import { z } from 'zod'
import type { RecipeInput } from './seed-recipes'

export const LIBRARY_EMAIL = 'library@ingredientbot.com'
export const LIBRARY_NAME = 'IngredientBot Library'

// ~1000 dishes, ~25 per cuisine across 40 original + 10 new cuisines (expanded
// 2026-08-29, FOU seed-recipe-library-1000: deepened all 40 original cuisines
// from 10 to 20 dishes and added 10 genuinely new cuisines at 20 dishes each).
export const DEFAULT_DISHES: Record<string, string[]> = {
  Italian: [
    'spaghetti carbonara', 'lasagna alla bolognese', 'osso buco with gremolata', 'risotto alla milanese',
    'chicken piccata', 'gnocchi al pesto', 'pasta e fagioli', 'saltimbocca alla romana', 'panzanella salad',
    'tiramisu',
    'caprese salad', 'eggplant parmigiana', 'arancini', 'minestrone soup', 'bucatini all\'amatriciana',
    'veal marsala', 'pappardelle al cinghiale', 'focaccia genovese', 'bruschetta al pomodoro', 'panna cotta',
  ],
  French: [
    'coq au vin', 'boeuf bourguignon', 'quiche lorraine', 'ratatouille', 'salade nicoise', 'croque monsieur',
    'sole meuniere', 'cassoulet', 'crepes suzette', 'creme brulee',
    'bouillabaisse', 'duck confit', 'french onion soup', 'tarte tatin', 'steak frites',
    'escargots a la bourguignonne', 'vichyssoise', 'tartiflette', 'pissaladiere', 'madeleines',
  ],
  Spanish: [
    'paella de mariscos', 'tortilla espanola', 'gambas al ajillo', 'patatas bravas', 'gazpacho andaluz',
    'pollo al ajillo', 'fabada asturiana', 'pisto manchego', 'churros con chocolate', 'crema catalana',
    'jamon croquetas', 'albondigas en salsa', 'pulpo a la gallega', 'cocido madrileno', 'arroz negro',
    'escalivada', 'salmorejo cordobes', 'calamares a la romana', 'empanada gallega', 'tarta de santiago',
  ],
  Portuguese: [
    'bacalhau a bras', 'caldo verde', 'frango piri-piri', 'arroz de marisco', 'bifanas', 'polvo a lagareiro',
    'acorda de camarao', 'feijoada transmontana', 'pasteis de nata', 'arroz doce',
    'bacalhau a gomes de sa', 'cataplana de marisco', 'alheira grelhada', 'sardinhas assadas',
    'tripas a moda do porto', 'francesinha', 'cozido a portuguesa', 'ameijoas a bulhao pato',
    'queijadas de sintra', 'bolo rei',
  ],
  Greek: [
    'moussaka', 'souvlaki with tzatziki', 'spanakopita', 'avgolemono soup', 'gemista stuffed vegetables',
    'pastitsio', 'horiatiki village salad', 'gigantes plaki', 'kleftiko lamb', 'galaktoboureko',
    'dolmades', 'saganaki', 'fasolada', 'briam', 'loukaniko sausage', 'keftedes', 'revithia chickpea stew',
    'taramasalata', 'melomakarona', 'bougatsa',
  ],
  Turkish: [
    'iskender kebab', 'lahmacun', 'manti dumplings', 'imam bayildi', 'menemen', 'kofte with bulgur pilaf',
    'pide with cheese', 'mercimek corbasi lentil soup', 'borek with spinach', 'baklava',
    'adana kebab', 'karniyarik', 'hunkar begendi', 'cig kofte', 'pilav with orzo', 'midye dolma',
    'testi kebabi', 'simit', 'kunefe', 'turkish delight (lokum)',
  ],
  Lebanese: [
    'chicken shawarma plate', 'kibbeh', 'fattoush salad', 'mujadara', 'batata harra', 'kafta skewers',
    'stuffed grape leaves', 'shish taouk', 'manakish zaatar', 'knafeh',
    'hummus with lamb', 'baba ganoush', 'tabbouleh', 'moujadara with caramelized onions', 'sfeeha',
    'warak enab', 'freekeh pilaf', 'sayadieh fish and rice', 'lebanese lentil soup', 'maamoul',
  ],
  Moroccan: [
    'chicken tagine with preserved lemon', 'lamb tagine with apricots', 'harira soup', 'couscous royale',
    'zaalouk eggplant dip', 'bastilla chicken pie', 'kefta mkaouara meatball tagine', 'rfissa',
    'moroccan carrot salad', 'mint tea cookies (ghriba)',
    'mechoui roasted lamb', 'tangia marrakchia', 'harcha semolina griddle bread', 'chermoula fish tagine',
    'bissara fava bean soup', 'batbout stuffed flatbread', 'moroccan orange and cinnamon salad',
    'sellou almond sesame sweet', 'msemen layered pancakes', 'moroccan mint tea',
  ],
  Ethiopian: [
    'doro wat', 'misir wat red lentils', 'tibs sauteed beef', 'shiro wat', 'gomen collard greens',
    'kitfo', 'atkilt wat cabbage and carrots', 'azifa lentil salad', 'ful medames breakfast', 'injera flatbread',
    'yebeg wat lamb stew', 'key wat spicy beef stew', 'alicha tibs mild beef', 'dabo kolo snack',
    'gored gored', 'tikil gomen', 'fosolia green bean stew', 'sambusa', 'dabo bread', 'tej honey wine',
  ],
  Nigerian: [
    'jollof rice', 'egusi soup with pounded yam', 'suya skewers', 'moin moin', 'pepper soup',
    'akara bean fritters', 'ofada rice with ayamase', 'chicken stew with fried plantain', 'okra soup', 'puff puff',
    'efo riro', 'banga soup', 'edikang ikong', 'nkwobi', 'asun spicy goat', 'fisherman soup nigerian',
    'chin chin', 'nigerian meat pie', 'boli grilled plantain', 'zobo drink',
  ],
  Indian: [
    'butter chicken', 'palak paneer', 'chana masala', 'rogan josh', 'chicken biryani', 'aloo gobi',
    'dal makhani', 'tandoori chicken', 'malai kofta', 'gulab jamun',
    'chicken tikka', 'saag gosht', 'baingan bharta', 'vindaloo', 'samosas', 'pav bhaji', 'dosa with sambar',
    'rajma masala', 'kadai paneer', 'jalebi',
  ],
  Pakistani: [
    'chicken karahi', 'nihari', 'haleem', 'seekh kebabs', 'aloo keema', 'chapli kebab', 'daal chawal',
    'chicken pulao', 'paya curry', 'sheer khurma',
    'biryani sindhi style', 'saag with makki roti', 'karahi gosht', 'chicken tikka boti', 'aloo palak',
    'pakistani kheer', 'ras malai', 'samosa chaat', 'nihari beef', 'lassi',
  ],
  Thai: [
    'pad thai with shrimp', 'green curry with chicken', 'tom yum goong', 'massaman beef curry', 'som tum papaya salad',
    'pad krapow gai basil chicken', 'khao soi', 'tom kha gai', 'larb moo', 'mango sticky rice',
    'panang curry', 'pad see ew', 'tod mun pla fish cakes', 'khao pad thai fried rice', 'gaeng som fish curry',
    'moo ping grilled pork skewers', 'yum woon sen glass noodle salad', 'thai basil eggplant stir-fry',
    'kanom krok coconut pancakes', 'thai iced tea',
  ],
  Vietnamese: [
    'pho bo', 'banh mi thit', 'bun cha', 'goi cuon fresh spring rolls', 'com tam broken rice with pork chop',
    'cao lau noodles', 'banh xeo crispy pancake', 'bo kho beef stew', 'ga kho gung ginger chicken', 'che ba mau',
    'bun bo hue', 'banh cuon steamed rice rolls', 'cha ca la vong', 'mi quang', 'banh khot mini pancakes',
    'thit kho trung braised pork and eggs', 'canh chua sour fish soup', 'nem ran fried spring rolls',
    'xoi xeo sticky rice', 'ca phe sua da vietnamese iced coffee',
  ],
  Chinese: [
    'mapo tofu', 'kung pao chicken', 'char siu pork', 'beef chow fun', 'hot and sour soup', 'dan dan noodles',
    'sweet and sour pork', 'congee with century egg', 'scallion pancakes', 'egg fried rice',
    'peking duck', 'xiaolongbao soup dumplings', 'general tso chicken', 'twice cooked pork', 'wonton soup',
    'dry fried green beans', 'sichuan boiled fish', 'zhajiangmian noodles', 'mooncakes',
  ],
  Japanese: [
    'chicken katsu curry', 'miso ramen', 'oyakodon', 'chicken teriyaki', 'okonomiyaki', 'agedashi tofu',
    'gyoza dumplings', 'chirashi bowl', 'nikujaga beef and potato stew', 'matcha mochi',
    'tonkatsu', 'sukiyaki', 'unagi don', 'tempura moriawase', 'takoyaki', 'yakitori skewers', 'katsudon',
    'tonkotsu ramen', 'chawanmushi', 'dorayaki',
  ],
  Korean: [
    'bibimbap', 'kimchi jjigae', 'bulgogi', 'japchae', 'tteokbokki', 'sundubu jjigae soft tofu stew',
    'dakgalbi spicy chicken', 'kimchi fried rice', 'galbi short ribs', 'hotteok sweet pancakes',
    'samgyeopsal grilled pork belly', 'budae jjigae army stew', 'haemul pajeon seafood pancake',
    'naengmyeon cold noodles', 'gimbap', 'doenjang jjigae soybean paste stew', 'korean fried chicken',
    'jjajangmyeon black bean noodles', 'banchan assortment', 'bingsu shaved ice',
  ],
  Filipino: [
    'chicken adobo', 'sinigang na baboy', 'kare-kare', 'lumpia shanghai', 'pancit canton', 'lechon kawali',
    'tinola', 'sisig', 'arroz caldo', 'halo-halo',
    'pork adobo', 'bicol express', 'kaldereta', 'laing', 'pinakbet', 'chicken inasal', 'palabok', 'tapsilog',
    'leche flan filipino', 'ube halaya',
  ],
  Indonesian: [
    'nasi goreng', 'beef rendang', 'satay ayam with peanut sauce', 'gado-gado', 'soto ayam', 'mie goreng',
    'ayam bakar', 'tempeh orek', 'nasi uduk', 'pisang goreng',
    'rendang padang', 'sate lilit', 'gudeg jackfruit stew', 'rawon black beef soup', 'sambal goreng kentang',
    'martabak manis', 'es teler', 'bakso meatball soup', 'ayam goreng kalasan', 'klepon',
  ],
  Malaysian: [
    'chicken laksa', 'nasi lemak', 'char kway teow', 'beef massaman rendang', 'roti canai with dhal',
    'mee goreng mamak', 'ayam percik', 'sambal prawns', 'kangkung belacan', 'cendol',
    'nasi kandar', 'hokkien mee', 'popiah', 'otak-otak', 'curry mee', 'satay celup', 'ikan bakar',
    'rendang tok', 'roti john', 'kuih lapis',
  ],
  Mexican: [
    'tacos al pastor', 'chicken enchiladas verdes', 'chiles rellenos', 'pozole rojo', 'cochinita pibil',
    'mole poblano', 'sopa de tortilla', 'carne asada with salsa verde', 'elote street corn', 'tres leches cake',
    'birria de res', 'tamales oaxaquenos', 'chilaquiles verdes', 'enfrijoladas', 'huevos rancheros',
    'aguachile de camaron', 'tinga de pollo', 'esquites', 'camarones a la diabla', 'flan mexicano',
  ],
  Peruvian: [
    'ceviche clasico', 'lomo saltado', 'aji de gallina', 'papa a la huancaina', 'arroz con pollo peruano',
    'anticuchos', 'causa rellena', 'seco de res', 'tacu tacu', 'picarones',
    'rocoto relleno', 'chupe de camarones', 'tallarines verdes', 'chicharron de pescado',
    'escabeche de pescado', 'papa rellena', 'tamales peruanos', 'suspiro a la limena', 'pisco sour',
  ],
  Brazilian: [
    'feijoada completa', 'moqueca de peixe', 'coxinha', 'pao de queijo', 'picanha with farofa',
    'bobo de camarao', 'escondidinho', 'frango a passarinho', 'acaraje', 'brigadeiros',
    'churrasco misto', 'vatapa', 'casquinha de siri', 'tapioca crepe', 'carne de sol', 'bolinho de bacalhau',
    'pastel brasileiro', 'quindim', 'romeu e julieta', 'cocada',
  ],
  Argentinian: [
    'asado short ribs with chimichurri', 'empanadas mendocinas', 'milanesa napolitana', 'locro stew',
    'provoleta', 'choripan', 'matambre arrollado', 'pastel de papa', 'humita en chala', 'alfajores',
    'bife de chorizo', 'vacio al asador', 'sorrentinos', 'carbonada criolla', 'tortilla de papas argentina',
    'mollejas grilled sweetbreads', 'noquis del 29', 'dulce de leche crepes', 'chorizo criollo', 'torta rogel',
  ],
  Colombian: [
    'bandeja paisa', 'ajiaco santafereno', 'arepas con queso', 'sancocho de gallina', 'lechona tolimense',
    'patacones with hogao', 'carne en polvo', 'changua breakfast soup', 'arroz con coco', 'arroz con leche',
    'mondongo colombiano', 'arroz con pollo colombiano', 'empanadas colombianas', 'tamales colombianos',
    'mazamorra', 'bunuelos colombianos', 'pan de bono', 'obleas', 'chicharron colombiano', 'aborrajados',
  ],
  Cuban: [
    'ropa vieja', 'lechon asado with mojo', 'picadillo', 'arroz con frijoles negros', 'vaca frita',
    'cuban sandwich', 'camarones enchilados', 'tostones', 'yuca con mojo', 'flan cubano',
    'ajiaco cubano', 'moros y cristianos', 'bistec de palomilla', 'tamal en cazuela', 'croquetas de jamon',
    'pollo a la plancha cubano', 'pan con lechon', 'boliche mechado', 'natilla cubana', 'pastelitos de guayaba',
  ],
  Jamaican: [
    'jerk chicken', 'curry goat', 'ackee and saltfish', 'brown stew chicken', 'oxtail with butter beans',
    'escovitch fish', 'rice and peas', 'callaloo', 'jamaican beef patties', 'gizzada tarts',
    'jerk pork', 'festival fried dumplings', 'run down mackerel', 'stew peas', 'fried plantain jamaican style',
    'jamaican fried fish', 'bammy', 'mannish water', 'jamaican rum cake', 'sorrel drink',
  ],
  American: [
    'buttermilk fried chicken', 'classic meatloaf with mashed potatoes', 'clam chowder', 'cobb salad',
    'philly cheesesteak', 'bbq baby back ribs', 'lobster roll', 'chicken pot pie', 'sloppy joes', 'apple pie',
    'mac and cheese', 'buffalo wings', 'chicago deep dish pizza', 'texas brisket', 'reuben sandwich',
    'chicken fried steak', 'key lime pie', 'banana pudding', 'potato salad american', 's\'mores',
  ],
  'Southern US': [
    'shrimp and grits', 'chicken and dumplings', 'fried green tomatoes', 'collard greens with ham hock',
    'biscuits and sausage gravy', 'country fried steak', 'pimento cheese sandwiches', 'hoppin john',
    'cornbread skillet', 'peach cobbler',
    'fried catfish', 'okra and tomatoes', 'candied yams', 'southern smothered pork chops',
    'buttermilk biscuits with honey', 'chess pie', 'sweet tea', 'deviled eggs southern style',
    'red velvet cake', 'watermelon rind pickles',
  ],
  Cajun: [
    'chicken and sausage gumbo', 'crawfish etouffee', 'jambalaya', 'red beans and rice', 'blackened catfish',
    'shrimp creole', 'dirty rice', 'boudin balls', 'muffuletta sandwich', 'bananas foster',
    'crawfish boil', 'maque choux', 'alligator sauce piquante', 'oyster po boy', 'catfish courtbouillon',
    'pork cracklins', 'king cake', 'pralines', 'smothered pork chops cajun style', 'crawfish pie',
  ],
  'Tex-Mex': [
    'beef fajitas', 'chili con carne', 'cheese enchiladas with chili gravy', 'queso fundido', 'crispy beef tacos',
    'king ranch chicken casserole', 'frito pie', 'breakfast tacos', 'borracho beans', 'sopapillas',
    'carne guisada', 'chile relleno tex-mex style', 'migas', 'nachos supreme', 'tex-mex tamales',
    'chicken flautas', 'tortilla soup tex-mex', 'beef taco salad', 'chalupas', 'bunuelos tex-mex',
  ],
  British: [
    'fish and chips', 'shepherds pie', 'bangers and mash with onion gravy', 'beef wellington',
    'chicken tikka masala', 'toad in the hole', 'ploughmans lunch', 'cottage pie', 'full english breakfast',
    'sticky toffee pudding',
    'yorkshire pudding with roast beef', 'steak and kidney pie', 'scotch eggs', 'welsh rarebit', 'kedgeree',
    'eton mess', 'victoria sponge cake', 'trifle', 'bubble and squeak', 'spotted dick',
  ],
  Irish: [
    'irish beef stew', 'colcannon', 'dublin coddle', 'boxty potato pancakes', 'corned beef and cabbage',
    'irish soda bread', 'shepherds pie with lamb', 'seafood chowder', 'champ', 'bread and butter pudding',
    'bacon and cabbage', 'black pudding irish', 'barmbrack', 'potato farls', 'guinness beef pie',
    'smoked salmon on irish brown bread', 'apple tart irish', 'carrageen moss pudding', 'irish coffee',
    'dublin bay prawns',
  ],
  German: [
    'sauerbraten', 'schnitzel with spaetzle', 'bratwurst with sauerkraut', 'rouladen', 'kartoffelsuppe',
    'jagerschnitzel', 'kasespatzle', 'currywurst', 'flammkuchen', 'apfelstrudel',
    'konigsberger klopse', 'eisbein pork knuckle', 'maultaschen', 'leberkase', 'zwiebelkuchen onion tart',
    'labskaus', 'spatzle mit linsen', 'pretzel bavarian', 'black forest cake', 'berliner doughnuts',
  ],
  Polish: [
    'pierogi ruskie', 'bigos hunters stew', 'kotlet schabowy', 'zurek sour rye soup', 'golabki cabbage rolls',
    'placki ziemniaczane potato pancakes', 'kielbasa with onions', 'rosol chicken soup', 'kopytka', 'sernik cheesecake',
    'pierogi z miesem', 'flaki tripe soup', 'barszcz czerwony', 'oscypek grilled cheese',
    'makowiec poppy seed roll', 'gulasz wieprzowy', 'karp smazony fried carp', 'chlodnik cold beet soup',
    'faworki angel wings', 'paczki polish doughnuts',
  ],
  Hungarian: [
    'chicken paprikash', 'beef goulash', 'lecso', 'stuffed peppers toltott paprika', 'langos',
    'porkolt pork stew', 'halaszle fishermans soup', 'krumplifozelek potato stew', 'chicken schnitzel', 'somloi galuska',
    'gulyasleves soup', 'palacsinta hungarian crepes', 'dobos torte', 'halaszcsarda catfish paprikash',
    'rakott krumpli layered potato bake', 'hortobagyi palacsinta', 'turos csusza noodles with cottage cheese',
    'kurtoskalacs chimney cake', 'hungarian goose liver pate', 'csirkepaprikas nokedlivel',
  ],
  Russian: [
    'beef stroganoff', 'borscht with sour cream', 'pelmeni dumplings', 'chicken kiev', 'olivier salad',
    'solyanka soup', 'blini with smoked salmon', 'golubtsy stuffed cabbage', 'kotleti meat patties', 'syrniki',
    'pirozhki', 'shchi cabbage soup', 'vinegret beet salad', 'ukha fish soup', 'herring under a fur coat',
    'kulebyaka fish pie', 'kvass', 'medovik honey cake', 'russian black bread', 'kholodets meat aspic',
  ],
  Ukrainian: [
    'ukrainian borscht', 'varenyky with potato', 'chicken kyiv', 'holubtsi', 'deruny potato pancakes',
    'salo with garlic on rye', 'okroshka cold soup', 'banosh cornmeal porridge', 'kapusniak sauerkraut soup', 'medivnyk honey cake',
    'nalysnyky crepes', 'kutia wheat pudding', 'studenets meat jelly', 'postnyi borsch lenten borscht',
    'pampushky garlic bread rolls', 'verhuny fried pastries', 'kovbasa ukrainian sausage',
    'uzvar dried fruit compote', 'chicken cutlet kyivan style', 'ukrainian cherry dumplings',
  ],
  Swedish: [
    'swedish meatballs', 'gravlax with mustard sauce', 'jansson temptation potato gratin', 'raggmunk',
    'pyttipanna hash', 'toast skagen', 'kalops beef stew', 'inlagd sill pickled herring plate', 'pea soup with pancakes',
    'kanelbullar cinnamon buns',
    'smorgastarta sandwich cake', 'arctic char gravlax', 'fisksoppa swedish fish soup', 'falukorv sausage',
    'kroppkakor potato dumplings', 'semla cardamom bun', 'prinsesstarta princess cake',
    'lingonberry pancakes', 'dill boiled potatoes', 'ostkaka swedish cheesecake',
  ],
  Georgian: [
    'khachapuri adjaruli', 'khinkali dumplings', 'chicken satsivi', 'lobio bean stew', 'chakhokhbili chicken stew',
    'badrijani nigvzit eggplant rolls', 'mtsvadi pork skewers', 'kharcho soup', 'pkhali vegetable pates', 'churchkhela',
    'khachapuri imeruli', 'ajapsandali vegetable stew', 'ostri spicy beef stew',
    'georgian stuffed grape leaves (tolma)', 'kupati sausage', 'elarji corn and cheese porridge',
    'shkmeruli garlic chicken', 'gozinaki honey nut brittle', 'chvishtari cornbread',
    'chakapuli lamb and herb stew',
  ],
  Persian: [
    'chelo kabab koobideh', 'fesenjan pomegranate walnut stew', 'ghormeh sabzi herb stew',
    'tahchin saffron rice cake', 'zereshk polo ba morgh barberry rice with chicken',
    'baghali polo dill and fava bean rice', 'joojeh kabab saffron chicken skewers', 'ash reshteh noodle soup',
    'kuku sabzi herb frittata', 'mirza ghasemi smoky eggplant dip', 'dizi abgoosht lamb stew',
    'shirin polo sweet jeweled rice', 'kashk e bademjan eggplant and whey dip', 'gheimeh split pea stew',
    'sabzi khordan herb platter', 'persian saffron ice cream (bastani sonnati)',
    'faloodeh rosewater noodle sorbet', 'sholeh zard saffron rice pudding', 'torshi persian pickles',
    'noon barbari persian flatbread',
  ],
  Israeli: [
    'shakshuka', 'sabich pita', 'falafel with tahini', 'israeli couscous salad', 'malawach fried flatbread',
    'jachnun yemeni pastry', 'hummus masabacha', 'kubbeh soup', 'sufganiyot jelly doughnuts',
    'bourekas cheese pastry', 'matbucha tomato pepper salad', 'israeli schnitzel', 'cholent shabbat stew',
    'krembo chocolate marshmallow treat', 'israeli chopped salad with labneh', 'ptitim toasted pasta pilaf',
    'eggplant with tahini (mutabal)', 'rugelach', 'tahini halva', 'israeli olive bread',
  ],
  Egyptian: [
    'koshari', 'molokhia', 'ful medames egyptian style', 'ta\'ameya egyptian falafel',
    'mahshi stuffed vegetables', 'hawawshi stuffed flatbread', 'fattah egyptian',
    'sayadeya egyptian fish and rice', 'mombar stuffed sausage', 'bamia okra stew',
    'kofta egyptian style', 'roz bel laban egyptian rice pudding', 'basbousa semolina cake',
    'kunafa egyptian style', 'egyptian lentil soup (shorbet ads)', 'feteer meshaltet layered pastry',
    'om ali egyptian bread pudding', 'dukkah spiced nut dip', 'egyptian rice with vermicelli', 'tamiya sandwich',
  ],
  Senegalese: [
    'thieboudienne', 'yassa poulet', 'mafe peanut stew', 'soupou kandja okra soup',
    'accara black eyed pea fritters', 'thiakry millet pudding', 'dibi grilled lamb', 'ndambe bean stew',
    'sombi rice pudding', 'pastels senegalese fried pastries', 'bissap hibiscus drink',
    'lakh millet porridge', 'yassa poisson fish in onion sauce', 'caldou fish stew',
    'fataya stuffed pastries', 'tiep bou yapp senegalese rice with beef', 'thiacry couscous with yogurt',
    'banana beignets senegalese', 'attaya senegalese mint tea', 'mbaxal saloum senegalese rice and fish stew',
  ],
  'South African': [
    'bobotie', 'boerewors with pap', 'bunny chow', 'potjiekos stew', 'biltong', 'malva pudding',
    'chakalaka relish', 'sosaties skewers', 'braai lamb chops', 'cape malay curry', 'koeksisters',
    'samp and beans', 'waterblommetjie bredie', 'milk tart (melktert)', 'droewors',
    'denningvleis cape malay stew', 'peri peri chicken south african style', 'vetkoek fried dough',
    'bredie mutton stew', 'rooibos tea cake',
  ],
  'Sri Lankan': [
    'kottu roti', 'hoppers with egg (appa)', 'lamprais', 'sri lankan chicken curry',
    'dhal curry sri lankan style (parippu)', 'pol sambol coconut relish', 'string hoppers (idiyappam sri lankan)',
    'fish ambul thiyal sour fish curry', 'wattalappam coconut custard', 'sri lankan devilled prawns',
    'kiribath milk rice', 'gotu kola sambol', 'jaffna crab curry', 'sri lankan egg hoppers with lunu miris',
    'pittu steamed rice cylinders', 'sri lankan black beef curry', 'sothi coconut gravy',
    'sri lankan fish cutlets', 'kokis crispy rosette cookies', 'sri lankan mango curry',
  ],
  Burmese: [
    'mohinga fish noodle soup', 'tea leaf salad (laphet thoke)', 'ohn no khao swe coconut chicken noodles',
    'burmese pork curry (wet thar hin)', 'shan noodles', 'burmese samosa soup', 'kyay oh noodle soup',
    'nan gyi thoke thick noodle salad', 'burmese fish paste stir-fry (nga pi kyaw)',
    'burmese chicken curry (kyet thar hin)', 'htamin jin sour rice salad', 'burmese eggplant salad',
    'mont lin ma yar coconut rice cakes', 'burmese pumpkin soup',
    'balachaung fried shrimp paste condiment', 'burmese pickled tea leaf platter',
    'shwe yin aye coconut dessert', 'burmese chickpea tofu (tohu)', 'htoe mont sticky rice cake',
    'burmese fish curry',
  ],
  Taiwanese: [
    'taiwanese beef noodle soup (niu rou mian)', 'oyster omelet (o-a-jian)', 'lu rou fan braised pork rice',
    'taiwanese popcorn chicken', 'gua bao steamed pork buns', 'danzai noodles', 'three cup chicken (san bei ji)',
    'stinky tofu taiwanese', 'bawan taiwanese meatball', 'taiwanese peanut mochi rolls',
    'taiwanese sausage with sticky rice', 'taiwanese oyster vermicelli', 'taiwanese scallion pancake (cong you bing)',
    'taiwanese hot pot', 'bubble tea', 'taiwanese pork chop rice', 'taiwanese fried chicken cutlet',
    'tianbula fish cake skewers', 'sun cake (taiyang bing)', 'taiwanese shaved ice (baobing)',
  ],
  Singaporean: [
    'hainanese chicken rice', 'chili crab', 'laksa singaporean style', 'satay bee hoon',
    'char kway teow singaporean style', 'bak kut teh', 'roti prata with curry', 'singaporean fish head curry',
    'kaya toast with soft boiled eggs', 'singaporean carrot cake (chai tow kway)',
    'rojak singaporean fruit and vegetable salad', 'singaporean nasi lemak', 'wanton mee singaporean style',
    'otah otah grilled fish paste', 'murtabak singaporean', 'singaporean sambal stingray',
    'tau huay soybean pudding', 'singaporean pandan cake', 'singaporean prawn noodle soup',
    'singaporean bak chor mee',
  ],
  Hawaiian: [
    'poke bowl ahi tuna', 'kalua pig', 'loco moco', 'spam musubi', 'huli huli chicken', 'lomi lomi salmon',
    'laulau', 'poi', 'haupia coconut pudding', 'malasadas hawaiian doughnuts', 'saimin noodle soup',
    'hawaiian plate lunch chicken katsu', 'opakapaka fish hawaiian style', 'chicken long rice',
    'hawaiian macaroni salad', 'pipikaula dried beef', 'manapua steamed bun', 'haupia pie',
    'shave ice hawaiian', 'hawaiian sweet bread rolls',
  ],
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const ALL_DISHES: { cuisine: string; dish: string; publicSlug: string }[] = Object.entries(
  DEFAULT_DISHES,
).flatMap(([cuisine, dishes]) => dishes.map((dish) => ({ cuisine, dish, publicSlug: slugify(dish) })))

// Kept lenient like seed-recipes-ai.ts (providers' strict JSON modes reject
// min/max bounds). Nutrition is macros ONLY — allergen claims never come from
// this generation.
const PublicRecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  servings: z.number().int(),
  prepTimeMin: z.number().int(),
  cookTimeMin: z.number().int(),
  cuisine: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.string(),
      unit: z.string(),
    }),
  ),
  steps: z.array(z.string()),
  notes: z.string(),
  tags: z.array(z.string()).describe('5-8 short lowercase tags (diet, method, occasion, key ingredient)'),
  nutrition: z.object({
    calories: z.number().int(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
})

const SYSTEM_PROMPT = [
  'You are a recipe writer for a cooking app. Output realistic, well-tested recipes with accurate timing and nutrition estimates.',
  'Use plain home-cook language. Avoid filler ("delicious", "amazing"). Be specific about quantities and technique.',
  'Nutrition values are per-serving estimates. Tags are 5-8 short lowercase phrases.',
  'Never make allergen or "free from" claims anywhere in the text — allergen data is handled by a separate verified pipeline.',
  // FOU-439: the ds deployment's json_schema mode is generate-then-parse — a straight " in prose truncates the field.
  'In prose, use curly quotes (\u201c \u201d) for any quoted phrase; never straight double quotes. The JSON delimiters themselves stay straight double quotes — the curly-quote rule applies only to text inside a field.',
  // FOU-441: Azure's content filter 400s on meat prompts that drift into butchery — it killed the
  // ingredient run on "whole chicken" (label MultiSeverity_ViolenceScore). Keeping the text in the
  // kitchen clears the filter and is what a recipe wants anyway.
  'Stay in the kitchen: write about preparing and cooking the dish, never about animal husbandry, slaughter, butchery or processing.',
].join(' ')

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  return {
    count: Number(get('--count') ?? ALL_DISHES.length),
    dryRun: args.includes('--dry-run'),
    // Serial left the ds lane at ~8% of its 20-rpm cap, idling for the whole of every
    // ~35s call. The shared 18-rpm limiter still caps the total, so this cannot breach
    // quota. Pass --concurrency 1 for the old behaviour.
    concurrency: get('--concurrency') ? Math.max(1, Number(get('--concurrency'))) : 6,
  }
}

// Set only on real runs — dry-run never constructs a Prisma client.
let prismaRef: { $disconnect(): Promise<void> } | null = null

async function main() {
  const { count, dryRun, concurrency } = parseArgs()
  const dishes = ALL_DISHES.slice(0, count)

  if (dryRun) {
    // Fully offline by design — no AI providers or DB are contacted.
    const cuisines = new Set(dishes.map((d) => d.cuisine))
    console.log(
      `Dry run — would seed ${dishes.length} public recipes across ${cuisines.size} cuisines (of ${ALL_DISHES.length} defaults). No AI or DB calls made.`,
    )
    console.log(`House user: ${LIBRARY_EMAIL} (find-or-create, no password login).`)
    console.log('\nFirst 5:')
    for (const d of dishes.slice(0, 5)) console.log(`  /r/${d.publicSlug}  (${d.cuisine})`)
    console.log(
      '\nReal run requires AZURE_FOUNDRY_RESOURCE + AZURE_FOUNDRY_API_KEY (recipe generation, ds lane) and ' +
        'AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY (allergen fields).',
    )
    return
  }

  const { prisma } = await import('./_prisma')
  prismaRef = prisma
  const { batchObject, batchMap } = await import('./lib/ai-batch')
  const { verifyRecipeAllergens, requireVerifierEnv, UNVERIFIED_NOTICE } = await import('./lib/allergen-verify')
  const { buildRecipeRecord } = await import('./seed-recipes')

  requireVerifierEnv() // fail closed before any generation

  // House user that owns the public library. No password → cannot log in via
  // credentials (mirrors how User.password is nullable for OAuth-style rows).
  const library = await prisma.user.upsert({
    where: { email: LIBRARY_EMAIL },
    update: {},
    create: { email: LIBRARY_EMAIL, name: LIBRARY_NAME, emailVerified: new Date() },
  })

  console.log(`Seeding ${dishes.length} public recipes as ${LIBRARY_EMAIL}...`)
  let inserted = 0
  let skipped = 0
  let annotated = 0
  const failures: { name: string; reason: string }[] = []

  let processed = 0

  try {
    await batchMap(
      dishes,
      async ({ cuisine, dish, publicSlug }) => {
        const existing = await prisma.recipe.findUnique({ where: { publicSlug }, select: { id: true } })
        if (existing) {
          skipped++
          return null
        }

        // One row must never end the run: the onError handler below records a failure and
        // lets the remaining dishes proceed. FOU-441 is why — a content-filter 400 on a
        // single dish used to strand every later row, since providers:['ds'] has no fallback.
        // FOU-439 net: a quote-truncated field is valid JSON and arrives silently.
        // Floors are amputation checks, not quality bars: a real recipe cannot have
        // a 3-word description, 2 steps, or 1 ingredient.
        let r: z.infer<typeof PublicRecipeSchema> | null = null
        for (let attempt = 1; attempt <= 3 && !r; attempt++) {
          const c = await batchObject(
            `Generate a recipe for: ${dish} (${cuisine} cuisine). Pick reasonable serving size, cook time, and difficulty.`,
            PublicRecipeSchema,
            // tier is explicit on purpose: this is the public recipe library, so quality
            // lane. Contrast seed-recipes-ai.ts, which is demo-only and pinned to free.
            { system: SYSTEM_PROMPT, temperature: 0.7, tier: 'quality', providers: ['ds'] },
          )
          if (c.description.trim().length >= 60 && !/[{}]/.test(c.description) && c.steps.length >= 3 && c.ingredients.length >= 3) r = c
          else console.warn(`  ↻ ${dish}: recipe under FOU-439 floor — retry ${attempt}/3`)
        }
        if (!r) throw new Error(`${dish}: recipe failed the FOU-439 floor three times`)

        const allergen = await verifyRecipeAllergens({
          subject: r.title,
          ingredients: r.ingredients.map((ing) => `${ing.amount} ${ing.unit} ${ing.name}`.trim()),
        })
        annotated++

        await prisma.recipe.create({
          data: {
            ...buildRecipeRecord(r as unknown as RecipeInput, library.id),
            nutrition: r.nutrition, // macros only — overrides the RecipeInput shape
            tags: r.tags.slice(0, 8),
            isPublic: true,
            publicSlug,
            allergens: allergen.allergens,
            mayContain: allergen.mayContain,
            allergenNotes: allergen.allergenNotes,
            allergenAnnotatedAt: new Date(),
          },
        })
        inserted++
        console.log(`  [${++processed}/${dishes.length}] /r/${publicSlug}`)
        return null
      },
      {
        concurrency,
        // Same contract the serial version had: one bad dish is recorded and skipped, never
        // fatal. The allergen model rejects the occasional recipe outright, and a re-run
        // regenerates only what is missing because existing publicSlugs are skipped above.
        onError: (err, item) => {
          const reason = err instanceof Error ? err.message : String(err)
          const dish = (item as { dish: string }).dish
          failures.push({ name: dish, reason })
          console.warn(`  ✗ ${dish}: ${reason}`)
          return 'skip'
        },
      },
    )
  } finally {
    console.log(
      `\nDone — inserted ${inserted}, skipped ${skipped} (existing), ${annotated} allergen-annotated.`,
    )
    if (failures.length) {
      console.warn(`\n${failures.length} recipe(s) failed and were left unwritten:`)
      for (const f of failures) console.warn(`  - ${f.name}: ${f.reason}`)
      console.warn('Re-run the seeder to retry only these — existing rows are skipped.')
    }
    console.log(UNVERIFIED_NOTICE)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prismaRef?.$disconnect().catch(() => undefined))
