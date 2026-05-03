# Reports

`tools/evaluate.py` writes JSON and Markdown evaluation reports here.

Repository policy:

- `corpus_evaluation.json` and `corpus_evaluation.md` are the canonical tracked outputs
- timestamped report snapshots are workspace artifacts and should stay untracked
- do not commit base64 attachments, inline raw payload dumps, or one-off report exports here
