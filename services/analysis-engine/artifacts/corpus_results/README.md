# Corpus Results

`tools/corpus_run.py` writes timestamped run folders here.

Repository policy:

- keep this directory tracked only as a landing area plus documentation
- do not add new timestamped runs to git
- if a result set needs to become canonical, move it into the approved checked-in target instead of leaving multiple historical run trees here

Each run contains:

- `run_summary.json`
- `results/<case_id>.json`
