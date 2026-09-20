import React, { useState, useCallback } from 'react';


// Loading spinner component (consider using a real spinner library or custom CSS)
const Spinner = () => <p>Loading...</p>;

// Error display component
const ErrorDisplay = ({ message }) => (
  <p style={{ color: 'red' }}>{message}</p>
);

const RecipeModal = ({ recipe, loading, onClose }) => {
  if (!recipe) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-3">
          <h2 className="text-2xl font-bold">{recipe.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-xl leading-none">&times;</button>
        </div>
        <p className="text-sm text-gray-500 mb-2">Prep: {recipe.prep_time} min · Cook: {recipe.cook_time} min</p>
        <p className="text-gray-700 mb-4">{recipe.description}</p>

        {loading ? (
          <p className="text-gray-500">Loading details...</p>
        ) : (
          <>
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-1">Ingredients:</h3>
                <ul className="list-disc list-inside text-sm text-gray-700">
                  {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                </ul>
              </div>
            )}
            {recipe.directions && recipe.directions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-1">Directions:</h3>
                <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                  {recipe.directions.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Recommendations list component
const RecommendationsList = ({ recommendations, onSelect }) => (
  <>
    <h2 className="text-xl font-semibold mb-3">Recommendations:</h2>
    {recommendations.length > 0 ? (
      <ul className="space-y-4">
        {recommendations.map((item, index) => (
          <li
            key={index}
            onClick={() => onSelect(item)}
            className="border border-gray-200 rounded p-4 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition"
          >
            <h3 className="font-bold text-lg">{item.name}</h3>
            <p className="text-sm text-gray-500">
              Similarity: {item.similarity.toFixed(2)} · Prep: {item.prep_time} min · Cook: {item.cook_time} min
            </p>
            <p className="text-gray-700 mt-1">{item.description}</p>
            <p className="text-xs text-blue-600 mt-2">Click for full recipe →</p>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-gray-500">No recommendations available.</p>
    )}
  </>
);

function App() {
  const [preferences, setPreferences] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!preferences.trim()) {
      setError('Please enter your preferences before searching.');
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch('https://recipe-recommendation-system-za52.onrender.com/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();
      setRecommendations(data.recommendations);
      setSummary(data.summary);
    } catch (error) {
      setError('Error fetching recommendations. Please try again later.');
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [preferences]);
  
  const handleSelectRecipe = async (recipe) => {
    setSelectedRecipe({ ...recipe, ingredients: null, directions: null });
    setDetailsLoading(true);
    try {
      const response = await fetch(`https://recipe-recommendation-system-za52.onrender.com/recipe/${recipe.recipe_id}`);
      const data = await response.json();
      setSelectedRecipe(prev => ({ ...prev, ingredients: data.ingredients, directions: data.directions }));
    } catch (err) {
      console.error('Error fetching recipe details:', err);
    } finally {
      setDetailsLoading(false);
    }
};

const closeModal = () => setSelectedRecipe(null);

  return (
    <div className="max-w-2xl mx-auto p-8 font-sans">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Recipe Recommendation System</h1>
      <p className="text-gray-500 mb-6">
           Describe what you're craving, and get AI-powered recipe recommendations with real ingredients and step-by-step directions.
      </p>
      <div className="flex gap-2 mb-6 flex-wrap">
  {["spicy chicken curry", "chocolate dessert", "healthy salad", "quick pasta"].map((example) => (
    <button
      key={example}
      onClick={() => setPreferences(example)}
      className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full text-gray-700"
    >
      {example}
    </button>
  ))}
</div>
      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
        <input
          type="text"
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          placeholder="e.g. spicy chicken curry"
          className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Searching...' : 'Get Recommendations'}
        </button>
      </form>
      <div>
      
  {loading ? (
    <Spinner />
  ) : error ? (
    <ErrorDisplay message={error} />
  ) : hasSearched ? (
    <>
      {summary && <p className="italic text-gray-600 mb-4">{summary}</p>}
      <RecommendationsList recommendations={recommendations} onSelect={handleSelectRecipe} />
    </>
  ) : null}
</div>
<RecipeModal recipe={selectedRecipe} loading={detailsLoading} onClose={closeModal} />
    </div>
  );
}

export default App;

