// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrowserRouter, Link, Route, Routes, useParams } from './router';

function DocumentRoute() {
  const { id } = useParams<{ id: string }>();
  return <p>document:{id}</p>;
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('admin SPA router', () => {
  it('navigates internally and resolves decoded route parameters', () => {
    window.history.replaceState({}, '', '/documents');
    render(
      <BrowserRouter>
        <Link to="/documents/source%20document">open</Link>
        <Routes>
          <Route path="/documents" element={<p>list</p>} />
          <Route path="/documents/:id" element={<DocumentRoute />} />
        </Routes>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'open' }));

    expect(screen.getByText('document:source document')).toBeTruthy();
    expect(window.location.pathname).toBe('/documents/source%20document');
  });

  it('does not navigate to protocol-relative or external targets', () => {
    window.history.replaceState({}, '', '/documents');
    render(
      <BrowserRouter>
        <Link to="//evil.example/redirect">unsafe</Link>
      </BrowserRouter>,
    );

    const link = screen.getByRole('link', { name: 'unsafe' });
    expect(link.getAttribute('href')).toBe('/');
    fireEvent.click(link);
    expect(window.location.origin).not.toContain('evil.example');
    expect(window.location.pathname).toBe('/');
  });
});
