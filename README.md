# Hash Food

Hash Food is a React storefront and admin dashboard backed by the existing Express API and SQLite database.

## Local development

Requirements: Node.js 20+ and npm.

1. Install server dependencies from the project root:

   ```sh
   npm install
   ```

2. Start the API and frontend together with one command:

   ```sh
   npm run dev
   ```

   Open `http://127.0.0.1:5151` on this computer, or use the `Open on this Wi-Fi` URL printed in the terminal on a phone connected to the same Wi-Fi. The ports stay fixed at 5151 (frontend) and 3002 (backend); if one is occupied, stop the existing process and rerun the command. The frontend hot-reloads, and the API server restarts automatically when `server.js` changes. After updating the dev launcher itself, restart `npm run dev` once to load the change. Press Ctrl+C to stop both servers. For local development, the demo admin login is `admin` / `hashfood123`; change these credentials before sharing access beyond a trusted development network.

   Install frontend dependencies once if needed:

   ```sh
   npm run client:install
   ```

SQLite is stored separately in `database/hashfood.sqlite` by default. Set `DB_PATH` to use another path.

## Order statuses

Order statuses advance one step at a time in the admin dashboard:

- **Delivery:** Pending → Accepted → Preparing → Ready for Pickup → Out for Delivery → Delivered
- **Pickup:** Pending → Accepted → Preparing → Ready for Pickup → Completed
- **Dine-in:** Pending → Accepted → Preparing → Served → Completed
- **Cancellation:** Any non-terminal order may be cancelled.

Completed, delivered, and cancelled orders cannot be advanced further. Existing `Ready` orders are migrated to `Ready for Pickup` when the API starts.

The customer storefront uses a looping burger-grilling background video. The video and poster are stored in `client/public/videos/`; source: [Pixabay — Beef, patty, hamburger](https://pixabay.com/videos/beef-patty-hamburger-burger-grill-199545/), free stock video for use and download.

## Production build

Run from the project root:

```sh
npm run build
npm start
```

Express serves the optimized client from `client/dist`. The frontend and API share the same origin on port 3002.

## Public SEO routes

The public storefront is available at `/`, `/menu`, `/menu/category/:categoryId/:slug`, and `/product/:id/:slug`. Product and category pages are generated from active menu items in SQLite; old slugs redirect to their current canonical URL. Express serves route-specific metadata and structured product data, plus `/sitemap.xml` and `/robots.txt`. Checkout, tracking, and admin pages are noindex and are not included in the sitemap.

## Render deployment

- **Build command:** `npm run build`
- **Start command:** `npm start`
- **Environment variables:** `NODE_ENV=production`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (at least 12 characters), and `DB_PATH`.
- Attach a persistent disk and set `DB_PATH` to a location on that disk so SQLite data survives deployments.

## Checks

Run the API and database integration tests with `npm test`.

- **Customer flow:** Browse and search the menu, add items to the bag, select pickup/delivery, and place a cash order.
- **Order tracking:** Use the success page's tracking button. The order token is stored locally on the device used to place the order.
- **Admin flow:** Sign in at `/admin/login`, update order statuses, add menu categories and dishes, edit, hide, or delete dishes, save store settings, then sign out.
