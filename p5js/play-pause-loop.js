// A generic play/pause animation loop: requestAnimationFrame throttled to `fps` (default 30),
// calling `tick()` on every frame that clears the throttle. The caller's tick() owns what
// "advancing" means (wrap a fraction, step a slider value, ...) and any re-render it needs -
// this only owns the timing/throttle/button-toggle mechanics, which were previously duplicated
// verbatim between graphics/flower and graphics/Function3D. `fps` is a number, or a function
// returning one when the rate is user-adjustable (read fresh on every frame, e.g. the LED
// Editor's fps field).
function createPlayPauseLoop(button, tick, fps = 30) {
  const fpsNow = () => (typeof fps === 'function' ? fps() : fps);
  let running = false;
  let lastTime = 0;

  function frame(ts) {
    if (!running) return;
    if (ts - lastTime >= 1000 / fpsNow()) {
      lastTime = ts;
      tick();
    }
    requestAnimationFrame(frame);
  }

  function start() {
    running = true;
    lastTime = 0;
    button.innerHTML = '<i class="fa fa-pause"></i> Pause';
    requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    button.innerHTML = '<i class="fa fa-play"></i> Play';
  }

  button.addEventListener('click', () => running ? stop() : start());

  return { start, stop, get running() { return running; } };
}
