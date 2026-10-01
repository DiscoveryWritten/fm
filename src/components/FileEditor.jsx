import { useState, useEffect } from 'react';

import './FileEditor.css';
import { readText } from '../content';
import { edits as gameEdits } from '../edits';

const stop = (e) => e.stopPropagation();  // typing here isn't playing

// Edit one game file as text.  Save keeps it as a local edit, which the game
// picks up live; Revert drops the edit and goes back to the deployed file.
export default function FileEditor({ path, edits=gameEdits, onClose }) {
  const [text, setText] = useState(null);
  const [saved, setSaved] = useState(null);
  const [status, setStatus] = useState('');

  const load = () => readText(path)
    .then((text) => { setText(text); setSaved(text); })
    .catch(() => { setText(''); setSaved(''); setStatus('New file'); });

  useEffect(() => { load(); }, [path]);

  const dirty = text !== saved;
  const act = (label, work) => async () => {
    try {
      await work();
      setStatus(label);
    } catch (error) {
      setStatus(`Failed: ${error.message}`);
    }
  };

  const save = act('Saved', async () => {
    await edits.save(path, text);
    setSaved(text);
  });
  const revert = act('Back to the deployed file', async () => {
    await edits.revert(path);
    await load();
  });
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = Object.assign(document.createElement('a'), {
      href: url, download: path.split('/').pop(),
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const close = () => {
    if (!dirty || window.confirm('Close without saving?')) onClose();
  };

  return (
    <div className="file-editor" onKeyDown={stop} onKeyUp={stop}>
      <div className="file-editor-path">
        {edits.has(path) ? '*' : ''}{path}{dirty ? ' (changed)' : ''}
      </div>
      <textarea
        aria-label={path}
        value={text ?? ''}
        disabled={text === null}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
      />
      <div className="file-editor-actions">
        <button type="button" onClick={save} disabled={!dirty}>Save</button>
        <button type="button" onClick={revert} disabled={!edits.has(path)}>Revert</button>
        <button type="button" onClick={download}>Download</button>
        <button type="button" onClick={close}>Close</button>
      </div>
      <div className="file-editor-status" role="status">{status}</div>
    </div>
  );
}
