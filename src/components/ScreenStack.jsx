import Screen, { FONT_WIDTH, FONT_HEIGHT } from './Screen';

// A tap lands on a cell, not on whatever is drawn there: the stack is layers
// of transparent grids, so the coordinate is all there is to hit.  Each tap
// dispatches `touch` with the screen's name and the cell's row and column,
// for anything that cares what's at that spot.
function touchCell(screen, width, height) {
  return (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / (rect.width / width));
    const row = Math.floor((e.clientY - rect.top) / (rect.height / height));
    if (row < 0 || row >= height || col < 0 || col >= width) return;
    window.dispatchEvent(new CustomEvent('touch', { detail: { screen, row, col } }));
  };
}

export default function ScreenStack({
  screen,  // its name in `touch` events
  width, height,
  defaultBg, defaultFg,
  magnification, gutter,
  hints, buffers,
}) {
  const charWidth = FONT_WIDTH * magnification;
  const charHeight = FONT_HEIGHT * magnification;
  const w = width * charWidth;
  const h = height * charHeight;

  return (
    <div>
      {hints && (
        <div className="hints" style={{fontSize: charHeight / 4}}>
          {hints}
        </div>
      )}
      <div
        style={{backgroundColor: gutter, width: w, height: h}}
        onClick={screen ? touchCell(screen, width, height) : undefined}
      >
        {buffers.map(({ bg=defaultBg, fg=defaultFg, buffer, at }, i) => (
          <Screen
            key={i}
            width={width}
            height={height}
            bg={bg}
            fg={fg}
            buffer={buffer}
            at={at}
            magnification={magnification}
          />
        ))}
      </div>
    </div>
  );
}
