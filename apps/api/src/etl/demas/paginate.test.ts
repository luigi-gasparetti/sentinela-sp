import { describe, expect, it, vi } from 'vitest';
import { DemasHttpError, paginate, type JsonRecord } from './paginate.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function pages(...items: number[][]) {
  return items.map((ids) => jsonResponse({ ubs: ids.map((id) => ({ id })) }));
}

async function collect(source: AsyncIterable<JsonRecord>): Promise<JsonRecord[]> {
  const result: JsonRecord[] = [];
  for await (const record of source) result.push(record);
  return result;
}

const noSleep = () => Promise.resolve();

describe('paginate', () => {
  it('usa offset como número da página e para na página incompleta', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const response of pages([1, 2], [3, 4], [5])) fetcher.mockResolvedValueOnce(response);

    const records = await collect(
      paginate('/assistencia-a-saude/unidade-basicas-de-saude', 'ubs', {
        pageSize: 2,
        fetcher,
      }),
    );

    expect(records.map((record) => record.id)).toEqual([1, 2, 3, 4, 5]);
    const urls = fetcher.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls.map((url) => url.searchParams.get('offset'))).toEqual(['0', '1', '2']);
    expect(urls[0]?.origin + urls[0]!.pathname).toBe(
      'https://apidadosabertos.saude.gov.br/assistencia-a-saude/unidade-basicas-de-saude',
    );
  });

  it('faz uma requisição extra quando a última página vem cheia', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const response of pages([1, 2], [])) fetcher.mockResolvedValueOnce(response);

    const records = await collect(paginate('/x', 'ubs', { pageSize: 2, fetcher }));

    expect(records).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('envia os filtros e o limite na query string', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ubs: [] }));

    await collect(paginate('/x', 'ubs', { params: { uf: 'SP' }, fetcher }));

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.searchParams.get('uf')).toBe('SP');
    expect(url.searchParams.get('limit')).toBe('1000');
  });

  it('tenta de novo com espera crescente em HTTP 5xx e falhas de rede', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}, 502))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ ubs: [{ id: 1 }] }));
    const sleep = vi.fn<(ms: number) => Promise<void>>(noSleep);

    const records = await collect(
      paginate('/x', 'ubs', { fetcher, sleep, retryDelayMs: 100, pageSize: 10 }),
    );

    expect(records).toEqual([{ id: 1 }]);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
  });

  it('desiste depois de esgotar as tentativas', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse({}, 503));

    await expect(
      collect(paginate('/x', 'ubs', { fetcher, sleep: noSleep, retries: 2 })),
    ).rejects.toBeInstanceOf(DemasHttpError);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('não tenta de novo em erros do cliente (4xx)', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 404));

    await expect(collect(paginate('/x', 'ubs', { fetcher, sleep: noSleep }))).rejects.toThrow(
      'HTTP 404',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejeita respostas sem a lista esperada', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ outra: [] }));

    await expect(collect(paginate('/x', 'ubs', { fetcher }))).rejects.toThrow(
      '"ubs" não é uma lista',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejeita tamanho de página fora do intervalo aceito pela API', async () => {
    await expect(collect(paginate('/x', 'ubs', { pageSize: 1001 }))).rejects.toThrow(RangeError);
    await expect(collect(paginate('/x', 'ubs', { pageSize: 0 }))).rejects.toThrow(RangeError);
  });
});
