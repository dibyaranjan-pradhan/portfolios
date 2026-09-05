# Gour Hotels — Jaipur

A static, multi-page website for Gour Hotels, a small family-run Indian hotel chain flagshipped in Jaipur, Rajasthan. Built with plain HTML/CSS/JS — no build step, no framework.

## Pages

- `index.html` — Home: hero, quick availability check, featured rooms, key amenities, location, reviews, contact
- `rooms.html` — Rooms & Suites: full detail for all four room categories
- `booking.html` — Multi-step reservation flow with a live price calculator (demo only — no real payment is processed)
- `about.html` — Hotel history, property info, mission & values
- `amenities.html` — Full amenities list with highlighted features
- `gallery.html` — Filterable photo gallery (exterior, rooms, restaurant, pool, lobby, surroundings, events)
- `dining.html` — Rasoi restaurant: hours, menu, table reservation form
- `location.html` — Address, embedded map, nearby attractions and transit distances
- `reviews.html` — Ratings breakdown and guest testimonials
- `contact.html` — Phone, WhatsApp, email, address, map and an enquiry form
- `faq.html` — Common guest questions as an accordion
- `policies.html` — Cancellation, booking, refund, privacy and terms & conditions

## Run locally

From this directory, run:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Notes

- No backend: the booking form, contact form and dining reservation form are client-side demos (JavaScript only) — nothing is emailed or charged.
- Photography is loaded from Unsplash's image CDN; the maps are Google Maps embeds. All hotel branding, copy, pricing and imagery in this project is original/fictional and not affiliated with any real hotel.
