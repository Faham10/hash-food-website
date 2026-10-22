export default function BurgerVideoBackground() {
  return (
    <div className="burger-video-background" aria-hidden="true">
      <div className="burger-video-still" />
      <video autoPlay muted loop playsInline preload="metadata" poster="/videos/burger-grill-poster.jpg" tabIndex={-1}>
        <source src="/videos/burger-grill.mp4" type="video/mp4" />
      </video>
      <div className="burger-video-shade" />
    </div>
  );
}
