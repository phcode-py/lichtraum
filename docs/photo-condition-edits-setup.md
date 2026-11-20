# Editing when a photograph was taken — setup for Philipp

Editing a photograph now offers everything from "add a photograph": picture, title, place (list or a new pin on the map), when it was taken, walk ("No specific walk" or a walk the person created or joined), description, tags and sharing. The "What caught your eye?" field is no longer shown; existing category values stay in the database unchanged.

Place, pin, walk and tags save with the existing permissions. Saving "when it was taken" for a photograph that has **no** sun and weather record yet also works today (it inserts a new record).

**Prepared only:** changing the time of a photograph that **already** has a sun and weather record needs `20261120000000_photo_condition_edits.sql`. Until it is applied, the app saves everything else and says that this one part needs the setup.

**Risky change to existing storage, please review:** the migration lets an owner replace the saved sun and weather snapshot of their own photograph (UPDATE on `photo_conditions.snapshot`, own photographs only). It deletes nothing and does not touch other people's photographs, files or tags.

No migration has been applied and no hosted service changed by the coding agent. Coordinate application separately from a code upload.
