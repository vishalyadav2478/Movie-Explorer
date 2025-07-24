document.addEventListener('DOMContentLoaded', function() {
    // API Configuration with fallback
    const API_KEYS = [
        '3fd2be6f0c70a2a598f084ddfb75487c', // Primary key
        '4e8d8a08a5a0b6d7e3b7d6c5f8a3b2c9', // Backup key 1
        '5f8a3b2c94e8d8a08a5a0b6d7e3b7d6c'  // Backup key 2
    ];
    let currentApiKeyIndex = 0;
    
    const BASE_URL = 'https://api.themoviedb.org/3';
    const IMG_PATH = 'https://image.tmdb.org/t/p/w500';
    const BACKDROP_PATH = 'https://image.tmdb.org/t/p/original';
    
    // Local fallback data
    const LOCAL_MOVIES = [
        {
            id: 1,
            title: "Avengers: Endgame",
            poster_path: "/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
            release_date: "2019-04-24",
            vote_average: 8.3
        },
        {
            id: 2,
            title: "The Dark Knight",
            poster_path: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
            release_date: "2008-07-16",
            vote_average: 8.5
        },
        {
            id: 3,
            title: "Inception",
            poster_path: "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
            release_date: "2010-07-16",
            vote_average: 8.4
        }
    ];

    // DOM Elements
    const elements = {
        searchInput: document.getElementById('search-input'),
        searchBtn: document.getElementById('search-btn'),
        moviesGrid: document.getElementById('movies-grid'),
        spinner: document.getElementById('spinner'),
        categoryButtons: document.querySelectorAll('.category-btn'),
        movieModal: document.getElementById('movie-modal'),
        modalClose: document.getElementById('modal-close')
    };

    // Initialize
    fetchMovies('popular');

    // Event Listeners
    elements.searchBtn.addEventListener('click', searchMovies);
    elements.searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') searchMovies();
    });

    elements.categoryButtons.forEach(button => {
        button.addEventListener('click', function() {
            elements.categoryButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const category = this.dataset.category;
            const genre = this.dataset.genre;
            
            if (category) fetchMovies(category);
            else if (genre) fetchMoviesByGenre(genre);
        });
    });

    elements.modalClose.addEventListener('click', closeModal);
    elements.movieModal.addEventListener('click', function(e) {
        if (e.target === elements.movieModal) closeModal();
    });

    // API Functions with retry logic
    async function fetchWithRetry(url, retries = 3) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            if (retries > 0) {
                console.log(`Retrying... (${retries} attempts left)`);
                currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
                const newUrl = url.replace(/api_key=[^&]+/, `api_key=${API_KEYS[currentApiKeyIndex]}`);
                return fetchWithRetry(newUrl, retries - 1);
            }
            throw error;
        }
    }

    // Movie Fetching Functions
    async function fetchMovies(category) {
        showSpinner();
        try {
            const url = `${BASE_URL}/movie/${category}?api_key=${API_KEYS[currentApiKeyIndex]}`;
            const data = await fetchWithRetry(url);
            displayMovies(data.results);
        } catch (error) {
            console.error('API Error:', error);
            showError("Couldn't connect to movie database. Showing local movies.");
            displayMovies(LOCAL_MOVIES);
        } finally {
            hideSpinner();
        }
    }

    async function fetchMoviesByGenre(genreId) {
        showSpinner();
        try {
            const url = `${BASE_URL}/discover/movie?api_key=${API_KEYS[currentApiKeyIndex]}&with_genres=${genreId}`;
            const data = await fetchWithRetry(url);
            displayMovies(data.results);
        } catch (error) {
            console.error('API Error:', error);
            showError("Couldn't load movies by genre. Showing popular movies instead.");
            fetchMovies('popular');
        }
    }

    async function searchMovies() {
        const searchTerm = elements.searchInput.value.trim();
        if (!searchTerm) {
            fetchMovies('popular');
            return;
        }

        showSpinner();
        try {
            const url = `${BASE_URL}/search/movie?api_key=${API_KEYS[currentApiKeyIndex]}&query=${encodeURIComponent(searchTerm)}`;
            const data = await fetchWithRetry(url);
            
            if (data.results.length === 0) {
                showMessage(`No results found for "${searchTerm}". Try a different search.`);
                return;
            }
            
            displayMovies(data.results);
        } catch (error) {
            console.error('Search Error:', error);
            showError("Search failed. Showing popular movies instead.");
            fetchMovies('popular');
        } finally {
            hideSpinner();
        }
    }

    // Display Functions
    function displayMovies(movies) {
        elements.moviesGrid.innerHTML = '';
        
        if (!movies || movies.length === 0) {
            showMessage("No movies found. Try a different category or search.");
            return;
        }

        movies.forEach(movie => {
            const movieCard = createMovieCard(movie);
            elements.moviesGrid.appendChild(movieCard);
        });
    }

    function createMovieCard(movie) {
        const card = document.createElement('div');
        card.className = 'movie-card';
        
        const posterUrl = movie.poster_path 
            ? IMG_PATH + movie.poster_path 
            : 'https://via.placeholder.com/500x750?text=No+Poster';
        
        card.innerHTML = `
            <img src="${posterUrl}" alt="${movie.title}" class="movie-poster">
            <div class="movie-info">
                <h3 class="movie-title">${movie.title || 'Untitled Movie'}</h3>
                <div class="movie-meta">
                    <span>${movie.release_date?.substring(0, 4) || 'N/A'}</span>
                    <span class="movie-rating">${movie.vote_average?.toFixed(1) || 'N/A'}</span>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => openMovieModal(movie.id));
        return card;
    }

    async function openMovieModal(movieId) {
        showSpinner();
        try {
            const [movieData, creditsData] = await Promise.all([
                fetchWithRetry(`${BASE_URL}/movie/${movieId}?api_key=${API_KEYS[currentApiKeyIndex]}`),
                fetchWithRetry(`${BASE_URL}/movie/${movieId}/credits?api_key=${API_KEYS[currentApiKeyIndex]}`)
            ]);
            
            updateModalContent(movieData, creditsData);
            elements.movieModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('Modal Error:', error);
            showError("Couldn't load movie details. Please try again later.");
        } finally {
            hideSpinner();
        }
    }

    function updateModalContent(movie, credits) {
        document.getElementById('modal-backdrop').src = movie.backdrop_path 
            ? BACKDROP_PATH + movie.backdrop_path 
            : 'https://via.placeholder.com/1920x1080?text=No+Backdrop';
        
        document.getElementById('modal-poster').src = movie.poster_path 
            ? IMG_PATH + movie.poster_path 
            : 'https://via.placeholder.com/500x750?text=No+Poster';
        
        document.getElementById('modal-title').textContent = movie.title || 'No title available';
        document.getElementById('modal-year').textContent = movie.release_date?.substring(0, 4) || 'N/A';
        document.getElementById('modal-runtime').textContent = movie.runtime ? `${movie.runtime} mins` : 'N/A';
        document.getElementById('modal-rating').textContent = movie.vote_average ? `${movie.vote_average.toFixed(1)}/10` : 'N/A';
        document.getElementById('modal-genres').textContent = movie.genres?.map(g => g.name).join(', ') || 'N/A';
        document.getElementById('modal-overview').textContent = movie.overview || 'No overview available.';
        
        const castGrid = document.getElementById('cast-grid');
        castGrid.innerHTML = '';
        
        credits.cast?.slice(0, 6).forEach(person => {
            const castCard = document.createElement('div');
            castCard.className = 'cast-card';
            castCard.innerHTML = `
                <img src="${person.profile_path ? IMG_PATH + person.profile_path : 'https://via.placeholder.com/150x225?text=No+Photo'}" 
                    alt="${person.name}" class="cast-photo">
                <h4 class="cast-name">${person.name || 'N/A'}</h4>
                <p class="cast-character">${person.character || 'N/A'}</p>
            `;
            castGrid.appendChild(castCard);
        });
    }

    // Utility Functions
    function showMessage(message) {
        elements.moviesGrid.innerHTML = `<p class="info-message">${message}</p>`;
    }

    function showError(message) {
        elements.moviesGrid.innerHTML = `<p class="error-message">⚠️ ${message}</p>`;
    }

    function closeModal() {
        elements.movieModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    function showSpinner() {
        elements.spinner.style.display = 'block';
        elements.moviesGrid.style.opacity = '0.5';
    }

    function hideSpinner() {
        elements.spinner.style.display = 'none';
        elements.moviesGrid.style.opacity = '1';
    }
});