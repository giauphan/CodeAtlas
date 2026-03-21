import React from 'react';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilters: {
    module: boolean;
    function: boolean;
    class: boolean;
    variable: boolean;
  };
  toggleFilter: (type: 'module' | 'function' | 'class' | 'variable') => void;
  onSearchEnter: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  activeFilters,
  toggleFilter,
  onSearchEnter
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchEnter();
    }
  };

  return (
    <div className="search-bar-container">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search functions, classes, modules..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {searchQuery && (
          <button className="clear-btn" onClick={() => setSearchQuery('')}>
            ×
          </button>
        )}
      </div>

      <div className="filter-pills">
        <button
          className={`filter-pill type-module ${activeFilters.module ? 'active' : ''}`}
          onClick={() => toggleFilter('module')}
        >
          Modules
        </button>
        <button
          className={`filter-pill type-function ${activeFilters.function ? 'active' : ''}`}
          onClick={() => toggleFilter('function')}
        >
          Functions
        </button>
        <button
          className={`filter-pill type-class ${activeFilters.class ? 'active' : ''}`}
          onClick={() => toggleFilter('class')}
        >
          Classes
        </button>
        <button
          className={`filter-pill type-variable ${activeFilters.variable ? 'active' : ''}`}
          onClick={() => toggleFilter('variable')}
        >
          Variables
        </button>
      </div>
    </div>
  );
};

export default SearchBar;
