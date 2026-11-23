/**
 * Paginação genérica da API de Dados Abertos do Ministério da Saúde (DEMAS).
 *
 * Particularidades da API, verificadas em nov/2026:
 * - Os endpoints ficam na raiz (sem o prefixo `/v1`, que retorna 404).
 * - `offset` é o número da página, não a quantidade de registros pulados.
 * - `limit` aceita até 1000.
 * - Cada resposta é um objeto com a lista de registros numa chave própria
 *   (ex.: `{ "ubs": [...] }`).
 */

export const DEMAS_BASE_URL = 'https://apidadosabertos.saude.gov.br';
export const MAX_PAGE_SIZE = 1000;

export type JsonRecord = Record<string, unknown>;

export interface PaginateOptions {
  /** Filtros enviados na query string (ex.: `{ uf: 'SP' }`). */
  params?: Record<string, string>;
  pageSize?: number;
  /** Tentativas extras após uma falha de rede, HTTP 429 ou 5xx. */
  retries?: number;
  /** Espera antes da primeira nova tentativa; dobra a cada falha. */
  retryDelayMs?: number;
  timeoutMs?: number;
  baseUrl?: string;
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class DemasHttpError extends Error {
  readonly status: number;

  constructor(url: URL, status: number) {
    super(`DEMAS respondeu HTTP ${status} em ${url.pathname}${url.search}`);
    this.name = 'DemasHttpError';
    this.status = status;
  }
}

/** Resposta 200 com corpo fora do formato esperado. Não adianta tentar de novo. */
export class DemasPayloadError extends Error {
  override name = 'DemasPayloadError';
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRetryable(error: unknown): boolean {
  if (error instanceof DemasHttpError) {
    return error.status === 429 || error.status >= 500;
  }
  if (error instanceof DemasPayloadError || error instanceof SyntaxError) {
    return false;
  }
  // Falhas de rede e timeouts (TypeError, AbortError, TimeoutError).
  return true;
}

function extractRecords(payload: unknown, collectionKey: string): JsonRecord[] {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new DemasPayloadError('Resposta inválida da API do DEMAS: o corpo não é um objeto.');
  }
  const records = (payload as Record<string, unknown>)[collectionKey];
  if (!Array.isArray(records)) {
    throw new DemasPayloadError(
      `Resposta inválida da API do DEMAS: "${collectionKey}" não é uma lista.`,
    );
  }
  return records.map((record, index) => {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      throw new DemasPayloadError(`Registro inválido na posição ${index} de "${collectionKey}".`);
    }
    return record as JsonRecord;
  });
}

async function fetchPage(
  url: URL,
  collectionKey: string,
  options: Required<Omit<PaginateOptions, 'params' | 'pageSize' | 'baseUrl'>>,
): Promise<JsonRecord[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await options.fetcher(url, {
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) {
        throw new DemasHttpError(url, response.status);
      }
      return extractRecords(await response.json(), collectionKey);
    } catch (error) {
      if (attempt >= options.retries || !isRetryable(error)) {
        throw error;
      }
      await options.sleep(options.retryDelayMs * 2 ** attempt);
    }
  }
}

/** Percorre todas as páginas de um endpoint, devolvendo um registro por vez. */
export async function* paginate(
  path: string,
  collectionKey: string,
  options: PaginateOptions = {},
): AsyncGenerator<JsonRecord> {
  const pageSize = options.pageSize ?? MAX_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(`pageSize deve ser um inteiro entre 1 e ${MAX_PAGE_SIZE}.`);
  }

  const requestOptions = {
    retries: options.retries ?? 3,
    retryDelayMs: options.retryDelayMs ?? 1000,
    timeoutMs: options.timeoutMs ?? 60_000,
    fetcher: options.fetcher ?? fetch,
    sleep: options.sleep ?? defaultSleep,
  };

  for (let page = 0; ; page++) {
    const url = new URL(path, options.baseUrl ?? DEMAS_BASE_URL);
    for (const [key, value] of Object.entries(options.params ?? {})) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(page));

    const records = await fetchPage(url, collectionKey, requestOptions);
    yield* records;

    if (records.length < pageSize) {
      return;
    }
  }
}
