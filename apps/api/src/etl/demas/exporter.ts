
import type { Doenca, NotificacaoNormalizada } from "./types.ts";
import type { ResultadoProcessamento } from "./processor.ts";
import type { RelatorioIngestao } from "./report.ts";
import type { OpcoesIngestao } from "./pipeline.ts";

import { ingerirNotificacoes } from "./pipeline.ts";
import { resumirIngestao } from "./report.ts";

const MUNICIPIO_SAO_PAULO = "355030";

export interface MetadadosExportacao {
	doenca: Doenca;
	municipioNotificacao: string;
	fonte: "DEMAS";
	dataReferencia: string;
}

export interface ExportacaoIngestao {
	metadados: MetadadosExportacao;
	notificacoes: NotificacaoNormalizada[];
	qualidade: RelatorioIngestao;
}

export async function exportarIngestao(
	doenca: Doenca,
	opcoes: Omit<OpcoesIngestao, "municipioNotificacao">,
	fetcher: typeof fetch = fetch,
): Promise<ExportacaoIngestao> {
	const notificacoes: NotificacaoNormalizada[] = [];

	const resultados = ingerirNotificacoes(
		doenca,
		{
			...opcoes,
			municipioNotificacao: MUNICIPIO_SAO_PAULO,
		},
		fetcher,
	);

	async function* registrarNotificacoes(): AsyncGenerator<ResultadoProcessamento> {
		for await (const resultado of resultados) {
			notificacoes.push(resultado.notificacao);
			yield resultado;
		}
	}

	const qualidade = await resumirIngestao(registrarNotificacoes());

	return {
		metadados: {
			doenca,
			municipioNotificacao: MUNICIPIO_SAO_PAULO,
			fonte: "DEMAS",
			dataReferencia: opcoes.dataReferencia,
		},
		notificacoes,
		qualidade,
	};
}
