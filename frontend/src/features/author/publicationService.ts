import api from '../../lib/axios';

export const publicationService = {
  async getBook(bookId: number) { return (await api.get(`/authors/me/books/${bookId}`)).data.metadata; },
  async getChapter(endpoint: string) { return (await api.get(endpoint)).data.metadata; },
  async save(endpoint: string, edit: boolean, data: object) {
    return (await api.request({ url: endpoint, method: edit ? 'PATCH' : 'POST', data, timeout: 30000 })).data.metadata;
  },
};
