# What's Next

A personal "what to watch" guide: movies and TV, swipe mode, mood picker, a spoiler-free Gemini assistant, taste DNA, release radar, movie night for groups, profiles with kids mode and PINs, a guest session, Google Drive sync, installable on your phone.

## Run it locally
```
npm install
npm run dev        # http://localhost:5173
npm test           # 18 tests
npm run build      # outputs dist/
```
On first open, pick or create a profile (or use Guest), then open Settings and paste:
- a free **TMDB** API key (themoviedb.org/settings/api), required
- a free **Gemini** API key (aistudio.google.com/apikey), optional, powers Ask, Mood and DNA
- an **OMDb** key, optional, adds IMDb and Rotten Tomatoes ratings

## Put it online for free, permanently
1. Install git and the GitHub CLI, then `gh auth login`.
2. `npm run deploy` (or `npm run deploy -- my-repo-name`).

It creates a public repo, pushes, turns on GitHub Pages and prints your URL: `https://<you>.github.io/<repo>/`. Every later `git push` redeploys automatically through `.github/workflows/deploy.yml`. Netlify or Cloudflare Pages also work: build command `npm run build`, output `dist`.

Open that URL on your phone and choose "Add to Home Screen".

## Accounts and sync (Supabase, free)
Sign-in is an **email and password**; each account's lists and profiles are saved to a free Supabase project so they follow you to any device. One-time setup (about 5 minutes):
1. Create a free project at supabase.com.
2. **SQL Editor** → paste all of `supabase/setup.sql` → Run. This creates the two tables and the rules that keep every account's data private.
3. **Authentication → Providers → Email**: leave it on. To skip confirmation emails (simplest for a few people), turn **Confirm email** off.
4. **Authentication → URL Configuration**: set **Site URL** to your site address (for example `https://<you>.github.io/whats-next/`). This is where password-reset links send people.
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key. Put them in `src/core/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), or as GitHub repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, or type them once on the sign-in screen. Both are safe to publish: the rules in `setup.sql` mean the key can only reach each signed-in person's own rows.
Free-plan limits are far above a handful of users. A project that nobody opens for a week is paused; open the Supabase dashboard to resume it.

**Fingerprint or face unlock (optional).** Settings → Account → *Turn on*. After signing out, one touch brings you back in, and any profile can be locked with it too. It is a convenience lock on that device; your password remains the real key, and it only appears on devices that support it.

## Profiles and privacy
- Each profile has its own library, ratings and accent colour. API keys are shared on the device.
- Kids profiles only get family-friendly titles, and the AI is told the viewer is a child.
- A PIN only keeps people from switching into a profile casually. It is not encryption.
- Guest sessions live in memory only. Close the tab and they are gone, unless you save them as a profile.

## Where things are
Eight places in the top menu (on a phone it becomes a scrolling strip under the header; there is no side panel).
- **Home (For you):** a full-width featured carousel, an AI prompt bar ("Describe your vibe", with quick chips; it opens Ask AI), Continue watching, mood shortcuts, then rows: a numbered Top 10, **Picked for you** (from your taste), "Because you liked ...", In cinemas, genre rows, Hidden gems, Under 100 minutes and an editorial grid.
- **Browse:** a sticky pill bar with the lists (Trending, This week, Popular, Top rated, Hidden gems, In theatres, Coming soon), genres (pick several), moods (Mind-bending, Edge-of-your-seat, Feel-good, Dark & gritty, Late-night chill), **Under 2 hours** and **Rated 8+**. **Filters** opens a dropdown (a bottom sheet on phones) with every genre, language, year, rating, "my services", "hide seen" and **Show unreleased titles** (off by default).
- **Posters:** hover one for its genres and a one-line synopsis; click it for the **quick view**: muted trailer with a sound button, where to watch (Stream, Rent, Buy for your region), cast, and four similar titles with a match % once you have rated a few. **Full details** opens the whole page.
- **Radar:** the release calendar with time window, order, language and "only my taste".
- **Moods:** 30+ moods in four groups, combinable, with a Suggest button.
- **Ask AI**, **Swipe**, **Movie night**.
- **Library:** Watchlist, Watched, Not seen and Hidden (shows you are tracking sit at the top of the Watchlist under "In progress") with search, filters, sorting and grid or list. On a title page, **Watch in Stremio** opens the Stremio app on that title. For a TV show, tick **+1 episode** on its page to start tracking it automatically.

Everything about you lives under your avatar: switch profile, cloud sync, theme, settings, sign out.

**Unreleased titles** are never recommended. They only appear on Browse (when you turn the toggle on), Radar and Coming soon.

## Look and feel
Obsidian surfaces, one crimson accent, amber stars, Outfit for titles and Inter for everything else. No floating shapes, no particles, no emoji in the controls.
- **Dark:** obsidian with a crimson accent. **Light:** warm paper with a deeper crimson.
- Selected chips are inverted (dark on light, light on dark) so the accent colour is kept for the one thing that matters on each screen.
It follows your system theme; change it from the avatar menu or press `T`. Each profile can keep the theme accent or pick its own colour. `F` turns motion down or off.

## Speed and the endless feed
- **For You never runs out.** It keeps pulling new titles as you scroll, rotating between recommendations from titles you liked, discovery by your favourite genres, trending, and top-rated lists. It never repeats a title and skips anything you've watched or hidden.
- **Instant second visits.** TMDB answers are saved on your device (lists for a couple of hours, details for a day), identical requests are shared, and at most eight run at once. Posters are cached by the service worker and load at the right size for the screen.
- **Smooth long scrolling.** Off-screen posters are not rendered, and hover and scroll effects no longer trigger page-wide recalculation.

## Signing in
The first screen offers **Sign in**, **Sign up** and **Continue as guest**.
- **Email and password** sign-in or sign-up syncs every profile to your account, so nothing is lost and a new device is ready after you sign in.
- **On this device only:** Sign up lets you create a profile with just a name. It stays in this browser.
- **Guest** never saves or syncs anything. A guest can turn the session into a profile from the profile button.
- There is no email-and-password option, because that needs a server to keep passwords safe and this app is deliberately a static site.
- Profiles have no guest tile. "Sign out" in the profile picker returns you to this screen.

## If pages feel slow
Every request to TMDB now times out after 8 seconds and retries once. If the app says TMDB is slow, your network is probably throttling `api.themoviedb.org` (common on some Indian ISPs). Switching your DNS to 1.1.1.1 or 8.8.8.8, or using a VPN, fixes it. The next batch of For You picks is prepared in the background, so opening the app is instant after the first visit.

## Latest changes
- "Picked for you" says only "Based on your watch history". Saving to the watchlist no longer counts as liked or watched; only titles you rate 7+ shape recommendations.
- The AI assistant is a bubble at the bottom-right of every page (the Home prompt bar and the Ask AI menu item are gone).
- Release radar ranks upcoming titles by hype (most anticipated first), follows the languages picked in Settings by default, and has working week/month windows and genre filters.
- Each Home row has a See all arrow that expands into a page of more titles from that row.
- Clicking a poster opens the quick view. Everything from the full details page is inside it, so you scroll down in the same popup and no new page opens.
- Browse Filters panel now holds different options from the pill bar: sort, language, release years, age rating, how well known, genres to leave out, and toggles.
- The Guest session dialog has more spacing.

## Accounts and privacy
- An email account is the only way in. There is no guest mode and no local-only profile.
- Profiles belong to the account that created them. Each account has its own storage space (`wn:<account id>:…`), so a different account on the same browser sees none of it.
- Backups go to the app-only Drive folder of that same account, which only that account can read.
- Signing out forgets the account on the browser and returns to the sign-in page. Data saved before accounts existed moves into the first account that signs in.

## Watchlists
Your default list is called **Next to watch**. In Library → Watchlist, use **＋ New list** to make more (for example "Weekend films"), and **Edit list** to rename or delete one (deleting moves its titles back to Next to watch). With more than one list, the **＋** on a poster asks where to save the title. Lists sync with your Google account like the rest of your profile.

## Rewatch, animations and settings
- **Library → Rewatch** lists everything you've watched, with genre chips and a **Surprise me** button for a random pick.
- **Settings → Appearance → Animations**: Full, Lite (shorter, no blur) or Off. It's saved per device. Theme is there too.
- Settings is now a side-menu panel (General, Appearance, Streaming, AI and scores, Account, Your data).
- Marking a title watched slides it out of rows and grids and the rest closes the gap. Watched and hidden titles are kept off the Home screen; Browse has a Hide seen toggle (on by default).

## AI assistant
- Works from your watch history: the recommender builds a ranked list of titles you haven't seen and the AI chooses from it, then tailors the answer to your request. Watched and hidden titles are never suggested.
- With a Gemini key, Home's "Picked for you" also mixes in AI picks (marked "Picked by AI for your taste").
- Each AI call has a time limit and falls back to the next model, so it can't hang. The app asks Google which Gemini models your key can use and prefers the fast Lite ones for chat.

## More recent changes
- **Rewatch** is its own item in the top menu, next to Library.
- **Watchlists:** each list is a box with a poster fan, a random-pick button and (for your own lists) an edit button; **Edit lists** manages them all. Movies and shows share a list, with an All / Movies / TV shows toggle inside it.
- **Sync:** the login renews itself quietly with a refresh token, so you stay signed in.
- **Home rows** keep loading as you scroll sideways, each has a refresh button, and a title you mark watched leaves the slideshow.
- **AI:** questions about a specific title get an answer, not a list of similar titles.
- **Trailer:** Sound, Pause and Theater buttons. Theater opens a big dark player with a time slider.
- **Swipe** has a new layout: a bigger card with a rating chip, a details panel beside it on desktop, colour-coded action buttons (Never, Not seen, Watchlist, Seen it, Loved it), a session counter, Undo, Details and New deck.
- **Theater** is now just the trailer on a dark backdrop. Click anywhere or press Esc to close.
- Trailers only become visible once they are really playing, so YouTube's play/pause icon doesn't flash on screen.

## Movie night friends (share codes)
No requests or accounts to link. In **Movie night → Share your taste** you create a code (`wn-…`). It stores a small copy of the titles you've watched or saved (with your ratings) in your Supabase project. A friend pastes your code under **＋ Add a friend**, and your taste is used for the picks. Friends need an account in the same app. **Turn off** deletes the copy, so the code stops working. Nobody can list codes; only someone who has the exact code can read it. Filters in Movie night: type, genres, and **already watched by nobody / by one person / anyone**.

## When the AI is busy
If Gemini answers "high demand" the app waits a moment and tries again, and if it is still busy it answers from the movie database instead (titles like the ones you named, ranked by how many of them recommend each), so you never get a bare error.
