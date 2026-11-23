# Shared favourites in the Light atlas — setup for Philipp

Hovering over a picture in the Light atlas (map view list and gallery) shows a star at the bottom right. Favourites are **shared**: anyone can star a picture, everyone sees all stars (with who starred it), and anyone can remove a star again. The gallery filters offer "Favourites only".

**Prepared only:** apply `20261123000000_photo_favourites.sql`. It creates one new table with row-level security: a star can only be set on a photograph the person can see, and stars are only visible where the photograph is visible. It changes no existing table, photograph, file or permission. Deleting a photograph removes its star.

**Permission to review:** removing a star is allowed for anyone who can see the photograph, because favourites are a shared selection. Stars are metadata only; no photograph or file can be changed or deleted through this table.

Until the migration is applied, the site keeps stars in each person's browser and says so. After it is applied, those stars are added to the shared favourites on the person's next visit.

Nothing has been applied by the coding agent. Coordinate application separately from a code upload.
