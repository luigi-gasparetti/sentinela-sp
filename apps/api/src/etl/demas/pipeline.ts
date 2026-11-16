
import type { Doenca } from "./types.ts";
import { iterarNotificacoes } from "./client.ts";
import type { OpcoesConsulta } from "./client.ts";
import { processarNotificacao } from "./processor.ts";
import type { ResultadoProcessamento } from "./processor.ts";

export interface OpcoesIngestao extends OpcoesConsulta {
	dataReferencia: string;
}

export async function* ingerirNotificacoes(
	doenca: Doenca,
	opcoes: OpcoesIngestao,
	fetcher: typeof fetch = fetch,
): AsyncGenerator<ResultadoProcessamento> {
	for await (const registro of iterarNotificacoes(
		doenca,
		opcoes,
		fetcher,
	)) {
		yield processarNotificacao(
			registro,
			doenca,
			opcoes.dataReferencia,
		);
	}
}
