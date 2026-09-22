import './Screen.css';
import { BLANK, cellAt } from '../buffers';

export const FONT_WIDTH = 12;
export const FONT_HEIGHT = 20;

export default function Screen({ width, height, bg, fg, buffer, at, magnification=1 }) {
  return (
    <div className="screen">
      {Array.from({ length: height }, (_, y) => (
        <div key={y} className="screen-row" style={{
          width: FONT_WIDTH * magnification * width,
          height: FONT_HEIGHT * magnification
        }}>
          {Array.from({ length: width }, (_, x) => {
            const char = cellAt({ buffer, at }, y, x);
            return (
              <span className="screen-char" key={x} style={{
                width: FONT_WIDTH,
                height: FONT_HEIGHT,
                zoom: magnification,
                // borderColor: char ? fg : 'transparent',
                backgroundColor: !BLANK.includes(char) ? bg : 'transparent',
                color: char ? fg : 'transparent',
              }}>{char || '&nbsp;'}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
