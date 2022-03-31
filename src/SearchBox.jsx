import React from 'react';

export default function SearchBox({ filterText, onFilterTextChange, }) {
  return (
    <div className='SearchBox'>
      <input id="objectIdInput" type="text"
        value={filterText}
        placeholder="Search..."
        onChange={(e) => onFilterTextChange(e.target.value)} />

    </div>
  );
}