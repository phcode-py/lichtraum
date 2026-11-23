# Favourites in the Light atlas — setup for Philipp

Hovering over a picture in the Light atlas (map view list and gallery) shows a star at the bottom right. Starring marks the picture as a personal favourite; the gallery filters offer "Favourites only". Favourites are personal: nobody else sees your stars.

**Prepared only:** apply `20261123000000_photo_favourites.sql` so favourites are saved to each account. It creates one new table with row-level security (each person reads, adds and removes only their own stars; a picture can only be starred if the person can see it). It changes no existing table, photograph, file or permission. Deleting a photograph removes its stars with it.

Until the migration is applied, the site keeps favourites in the browser on that device and says so. After it is applied, those stars are moved to the person's account on their next visit.

Nothing has been applied by the coding agent. Coordinate application separately from a code upload.
