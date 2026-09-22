import { useState, useEffect, useCallback } from 'react';

import useEvent from './hooks/useEvent';
import { readText } from './content';

export default function Visualizer({ startWorld, width, height }) {
  const [rawWorld, setRawWorld] = useState(null);
  const [rawInteractions, setRawInteractions] = useState({});
  const [rawOverlays, setRawOverlays] = useState({});
  const [rawItems, setRawItems] = useState({});
  const [origin, setOrigin] = useState(null);
  const [fontDemo, setFontDemo] = useState(null);

  useEffect(() => {
    setRawWorld(null);
    setRawInteractions({});
    setRawOverlays({});
    setRawItems({});
  }, [startWorld]);

  useEffect(() => {
    setRawInteractions((interactions) => Object.fromEntries(
      Object.entries(interactions).filter(
        ([key, { type, coordinate }]) => type !== 'npc' && (
          !coordinate || (
            origin[0] <= coordinate[0]
            && coordinate[0] < origin[0] + height
            && origin[1] <= coordinate[1]
            && coordinate[1] < origin[1] + width
          ))  // fixme: doesn't get doors because it's baked in the key string
      ))
    );
  }, [origin]);

  useEffect(() => {
    readText('world/debug.txt')
      .then(setFontDemo)
      .catch(() => setFontDemo(null))
  }, []);

  useEventWorld({ setRawWorld });
  useEventInteractions({ setRawInteractions });
  useEventOverlays({ setRawOverlays });
  useEventItems({ setRawItems });
  useEventOrigin({ setOrigin });

  return (
    <div id="visualizer" hidden>
      <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'stretch'}}>
        <div>


          <h3 className="ti inverted large">Overlays</h3>
          {Object.entries(rawOverlays).map(([key, {
            overlay, directions, boxes, attributes: { fg, bg, ...rolls }, ...rest
          }]) => (
            <div key={key}>
              <h4 className="ti inverted large">{key}</h4>
              <code id="map" className="ti" style={{
                display: 'block',
                margin: 'auto',
              }}>
                <pre className="ti" style={{ whiteSpace: 'pre-line', backgroundColor: '#aaa' }}>{
                  boxes.length > 0
                    ? boxes.map(
                      box => rawWorld.split('\n').slice(box[0] - 1, box[2]).map(
                        row => row.slice(box[1] - 1, box[3])
                      ).join('\n') + '\n'
                    )
                    : 'GLOBAL'
                }</pre>
                <pre className="ti" style={{ whiteSpace: 'pre-line', backgroundColor: '#aaa' }}><span style={{ backgroundColor: `#${bg}`, color: `#${fg}` }}>#{fg} on {bg || 'transparent'}</span></pre>
                {Object.keys(rolls).length > 0 && <pre className="ti" style={{ whiteSpace: 'pre-wrap', backgroundColor: '#aaa' }}>
                  Roll &gt;= {
                    Object.entries(rolls).map(([key, value]) => `${key.replace('-', '/')}\n → ${value}`).join('\n')
                  }</pre>}
                {directions && <pre className="ti" style={{ whiteSpace: 'pre-wrap', backgroundColor: '#aaa' }}>{directions.map(
                  ([dy, dx]) => (
                    `${Math.abs(dy) || ''}${{[-1]: 'down', 1: 'up', 0:'(hold)'}[dy/(Math.abs(dy)||1)]}`
                    +` + ${Math.abs(dx) || ''}${{[-1]: 'right', 1: 'left', 0:'(hold)'}[dx/(Math.abs(dx)||1)]}`
                  )
                ).join('\n')}</pre>}
                <pre className="ti" style={{ whiteSpace: 'pre'/* , backgroundColor: `#${bg}`, color: `#${fg}` */ }}>{overlay}</pre>
              </code>
            </div>
          ))}
        </div>


        <div>
          <h3 className="ti inverted large">Map</h3>
          <h4 className="ti inverted large">world/{startWorld}</h4>
          <code>
            <pre className="ti inverted" style={{ whiteSpace: 'pre-wrap' }}>{rawWorld}</pre>
          </code>
        </div>


        <div>
          <h3 className="ti inverted large">Objects</h3>
          {Object.entries(rawInteractions).map(([key, {
            dataFile, text, type, label, short, attributes, destination,
            sprite,
            ...rest
          }]) => (
            <div key={key}>
              <h4 className="ti inverted large">
                {type === 'npc'
                  ? `${sprite} (${key}) → interactions/`
                  : type === 'world'
                    ? `(${key}) → world/`
                    : `${key}: `
                }{dataFile || type}{
                  ['world', 'door'].includes(type) ? ` → ${(destination || []).join(',')}` : null
                }
              </h4>
              <code id="map" className="ti" style={{
                display: 'block',
                margin: 'auto',
              }}>
                <pre className="ti" style={{ whiteSpace: 'pre-wrap', backgroundColor: '#aaa' }}>
                  {/* {rest && `${JSON.stringify(rest, null, 2)}\n`} */}
                  "{label}"{short ? ` (short)` : ''}
                  {'\n'}Data: {JSON.stringify(Object.fromEntries(
                    Object.entries(attributes).filter(([k]) => !/[A-Z]/.test(k))
                  ), null, 2)}
                  {'\n' + Object.entries(rest).filter(([k]) => /[A-Z]/.test(k)).map(([evt, data]) => (
                    (type != 'npc' || data.event) ? `${evt} ${
                      data.event
                        ? `☌ ${data.event}${
                            data.quality ? ` quality=${data.quality}` : ''
                          }${data.dataFile
                            ? ` → world/${data.dataFile}`
                            : ''}`
                        : ''
                    } ${data.destination
                      ? `▒ ${data.destination}`
                      : `… ${data.text}`
                    }` : null
                  )).filter(Boolean).join('\n')}
                </pre>
                <pre className="ti" style={{ whiteSpace: 'pre-line' }}>{text}</pre>
              </code>
            </div>
          ))}
        </div>
        <div>
          <h3 className="ti inverted large">Font Demo</h3>
          <code>
            <pre className="ti" style={{ whiteSpace: 'pre-wrap' }}>{fontDemo}</pre>
          </code>

          <h3 className="ti inverted large">Items</h3>
          {Object.entries(rawItems).map(([slot, {
              name, template, kind, sprite, text, icon, rarity, ...rest
            }]) => (
              <div key={slot}>
                <h4 className="ti inverted large">{kind}/{template}.txt</h4>
                <code>
                  <pre className="ti" style={{ whiteSpace: 'pre-line', backgroundColor: '#aaa' }}>
                    {icon || '-'} {name === "--" ? "(none)" : `"${name}" @rarity=${rarity}`}
                    {/* {JSON.stringify(rest, null, 2)} */}
                  </pre>
                  <pre className="ti" style={{ whiteSpace: 'pre-wrap' }}>
                    {text}
                  </pre>
                </code>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}


function useEventWorld({ setRawWorld }) {
  const rawWorldHandler = useCallback(({ detail: text }) => {
    setRawWorld(text);
  }, []);
  useEvent('world', rawWorldHandler);
}

function useEventInteractions({ setRawInteractions }) {
  const interactionHandler = useCallback(({ detail: { key, text, hydrated } }) => {
    setRawInteractions((interactions) => ({ ...interactions, [key]: { ...hydrated, text } }))
  }, []);
  useEvent('_interaction', interactionHandler);
}

function useEventOverlays({ setRawOverlays }) {
  const overlayHandler = useCallback(({ detail: { dataFile, overlay, ...rest } }) => {
    setRawOverlays((overlays) => ({ ...overlays, [dataFile]: {overlay, ...rest} }))
  }, []);
  useEvent('_overlay', overlayHandler);
}

function useEventItems({ setRawItems }) {
  const itemHandler = useCallback(({ detail: { on, text, data: {...data} } }) => {
    setRawItems((items) => ({ ...items, [on]: { text, ...data } }))
  }, []);
  useEvent('_item', itemHandler);
}

function useEventOrigin({ setOrigin }) {
  const originHandler = useCallback(({ detail: origin }) => {
    setOrigin(origin)
  }, []);
  useEvent('origin', originHandler);
}
