
import type { ProblemaValidacao } from "./validators.ts";
import type { ResultadoProcessamento } from "./processor.ts";

export interface ContagemProblema {
	campo: string;
	codigo: string;
	severidade: ProblemaValidacao["severidade"];
	quantidade: number;
}

export interface RelatorioIngestao {
	total: number;
	semProblemas: number;
	comAvisos: number;
	comErros: number;
	problemas: ContagemProblema[];
}

export async function resumirIngestao(
	resultados: AsyncIterable<ResultadoProcessamento>,
): Promise<RelatorioIngestao> {
	const relatorio: RelatorioIngestao = {
		total: 0,
		semProblemas: 0,
		comAvisos: 0,
		comErros: 0,
		problemas: [],
	};

	const contagens = new Map<string, ContagemProblema>();

	for await (const resultado of resultados) {
		relatorio.total++;

		const temAviso = resultado.problemas.some(
			(problema) => problema.severidade === "aviso",
		);
		const temErro = resultado.problemas.some(
			(problema) => problema.severidade === "erro",
		);

		if (resultado.problemas.length === 0) {
			relatorio.semProblemas++;
		}

		if (temAviso) {
			relatorio.comAvisos++;
		}

		if (temErro) {
			relatorio.comErros++;
		}

		for (const problema of resultado.problemas) {
			const chave = [
				problema.campo,
				problema.codigo,
				problema.severidade,
			].join(":");

			const existente = contagens.get(chave);

			if (existente) {
				existente.quantidade++;
			} else {
				contagens.set(chave, {
					campo: problema.campo,
					codigo: problema.codigo,
					severidade: problema.severidade,
					quantidade: 1,
				});
			}
		}
	}

	relatorio.problemas = [...contagens.values()].sort(
		(a, b) =>
			a.campo.localeCompare(b.campo) ||
			a.codigo.localeCompare(b.codigo) ||
			a.severidade.localeCompare(b.severidade),
	);

	return relatorio;
}
