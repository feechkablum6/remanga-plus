import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleDriveProvider, extractFolderId } from '../src/providers/google-drive.js';

describe('extractFolderId', () => {
  it('extracts ID from standard folder URL', () => {
    const url = 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ';
    assert.equal(extractFolderId(url), '1aBcDeFgHiJkLmNoPqRsTuVwXyZ');
  });

  it('extracts ID from folder URL with query params', () => {
    const url = 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ?usp=sharing';
    assert.equal(extractFolderId(url), '1aBcDeFgHiJkLmNoPqRsTuVwXyZ');
  });

  it('extracts ID from folder URL with trailing slash', () => {
    const url = 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/';
    assert.equal(extractFolderId(url), '1aBcDeFgHiJkLmNoPqRsTuVwXyZ');
  });

  it('returns null for non-Drive URLs', () => {
    assert.equal(extractFolderId('https://example.com/folder'), null);
  });

  it('returns null for Drive file URLs (not folder)', () => {
    assert.equal(extractFolderId('https://drive.google.com/file/d/abc123/view'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(extractFolderId(''), null);
  });
});

describe('GoogleDriveProvider', () => {
  it('has name google-drive', () => {
    const provider = new GoogleDriveProvider('fake-key');
    assert.equal(provider.name, 'google-drive');
  });

  it('canHandle detects Google Drive folder URLs', () => {
    const provider = new GoogleDriveProvider('fake-key');
    assert.equal(provider.canHandle('https://drive.google.com/drive/folders/abc123'), true);
    assert.equal(provider.canHandle('https://example.com/folder'), false);
    assert.equal(provider.canHandle('https://drive.google.com/file/d/abc123/view'), false);
  });
});
