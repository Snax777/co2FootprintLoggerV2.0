const BackgroundLayout = ({ children }) => {
  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="fixed top-0 left-0 w-full h-full object-cover -z-10"
        src="/Forest-Background.mp4"
      />
      <div className="fixed top-0 left-0 w-full h-full bg-black/60 -z-10" />

      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default BackgroundLayout;