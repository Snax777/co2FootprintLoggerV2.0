import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="max-w-xl p-8 rounded-lg bg-black/0 text-white text-center">
        <h1 className="text-3xl font-bold mb-4">CO→Logger</h1>
        <p className="mb-6">
          CO→Logger is your personal carbon footprint companion.
          Track your daily activities, measure their CO₂ impact, and set weekly goals.
        </p>
        <Link
          to="/app/register"
          className="inline-block px-6 py-3 bg-green-600 text-white font-semibold rounded hover:bg-green-500 transition"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
};

export default LandingPage;