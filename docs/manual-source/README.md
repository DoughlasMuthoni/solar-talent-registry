# User manual source

`manual.html` + `img/` render to `../Solar-Talent-Registry-User-Manual.pdf`.

- Edit `manual.html` (A4 print CSS), then: `python make_pdf.py manual.html ../Solar-Talent-Registry-User-Manual.pdf`
  (needs Python with `playwright` and Microsoft Edge installed).
- Screenshots in `img/` were taken from fictional demo records on a local copy (never real candidate data);
  the sign-in screens are from the live site. Retake them if the screens change.
