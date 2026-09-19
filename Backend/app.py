import os
import json
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from sentence_transformers import SentenceTransformer
from scipy.spatial.distance import cosine
from dotenv import load_dotenv
from groq import Groq
import time

load_dotenv()

app = Flask(__name__)
CORS(app)


def get_db_connection():
    conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
    return conn

model = SentenceTransformer('all-MiniLM-L6-v2')

def preferences_to_vector(preferences):
    vector = model.encode(preferences)
    return vector.tolist()


@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.json
    preferences = data.get('preferences')
    user_vector = data.get('user_vector')

    if preferences and not preferences.strip():
       return jsonify({'error': 'Preferences cannot be empty'}), 400

    if preferences:
       user_vector = preferences_to_vector(preferences)

    if not user_vector:
        return jsonify({'error': 'User vector not provided'}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT recipe_id, recipe_vector, name, description, prep_time, cook_time FROM recipes")
        recipes = cursor.fetchall()

        recommendations = []
        for recipe_id, recipe_vector, name, description, prep_time, cook_time in recipes:
            try:
                if not isinstance(recipe_vector, list):
                    recipe_vector = json.loads(recipe_vector)
                similarity = calculate_similarity(user_vector, recipe_vector)
                recommendations.append({
                    'recipe_id': recipe_id,
                    'name': name,
                    'similarity': float(similarity),
                    'description': description,
                    'prep_time': prep_time,
                    'cook_time': cook_time,
                })
            except ValueError as e:
                print(f"Error parsing recipe vector for recipe_id {recipe_id}: {str(e)}")

        recommendations.sort(key=lambda x: x['similarity'], reverse=True)
        top_recommendations = recommendations[:5]
        summary = generate_summary(preferences or "", top_recommendations)
        return jsonify({'recommendations': top_recommendations, 'summary': summary})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/recipe/<int:recipe_id>', methods=['GET'])
def get_recipe_details(recipe_id):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT instruction_text FROM directions WHERE recipe_id = %s ORDER BY step_id", (recipe_id,))
        directions = [row[0] for row in cursor.fetchall()]

        cursor.execute("SELECT ingredient_text FROM ingredients WHERE recipe_id = %s", (recipe_id,))
        ingredients = [row[0] for row in cursor.fetchall()]

        return jsonify({'ingredients': ingredients, 'directions': directions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def calculate_similarity(user_vector, recipe_vector):
    user_vec = np.array(user_vector)
    recipe_vec = np.array(recipe_vector)
    if np.linalg.norm(user_vec) == 0 or np.linalg.norm(recipe_vec) == 0:
        return 0
    return 1 - cosine(user_vec, recipe_vec)



groq_client = Groq(api_key=os.environ.get('GROQ_API_KEY'))

def generate_summary(preferences, top_recommendations):
    recipe_list = "\n".join([f"- {r['name']}: {r['description']}" for r in top_recommendations])
    prompt = f"""A user is looking for recipes matching: "{preferences}"

Here are the top matching recipes found:
{recipe_list}

Write a brief, friendly 2-3 sentence summary explaining why these recipes match what the user is looking for."""

    for attempt in range(3):
        try:
            response = groq_client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Groq API error: {e}")
            if attempt < 2:
                time.sleep(2)
            else:
                return "Recommendations are based on similarity to your preferences. (AI summary temporarily unavailable.)"
if __name__ == '__main__':
    app.run(debug=True)








