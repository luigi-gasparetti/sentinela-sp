
import type { Doenca } from "../src/etl/demas/types.ts";
import { ingerirNotificacoes } from "../src/etl/demas/pipeline.ts";
import { agregarCasosPorSemana } from "../src/etl/demas/aggregates.ts";
import type { ResultadoProcessamento } from "../src/etl/demas/processor.ts";

interface ContadoresIngestao {
	total: number;
	registrosComAvisos: number;
	registrosComErros: number;
}

async function* acompanharIngestao(
	doenca: Doenca,
	contadores: ContadoresIngestao,
): AsyncGenerator<ResultadoProcessamento> {
    const resultados = ingerirNotificacoes(doenca, {
        municipioNotificacao: "355030",
        limitePagina: 1000,
        dataReferencia: "2026-11-15",
    });

	for await (const resultado of resultados) {
		contadores.total++;

		if (resultado.problemas.some(p => p.severidade === "aviso")) {
			contadores.registrosComAvisos++;
		}

		if (resultado.problemas.some(p => p.severidade === "erro")) {
			contadores.registrosComErros++;
		}

		yield resultado;
	}
}

async function main() {
	const doencas: Doenca[] = [
		//"dengue",
		"chikungunya",
		"zika",
	];

	for (const doenca of doencas) {
		console.log(`\nConsultando ${doenca}...`);

		const contadores: ContadoresIngestao = {
			total: 0,
			registrosComAvisos: 0,
			registrosComErros: 0,
		};

		const resultados = acompanharIngestao(doenca, contadores);
		const curva = await agregarCasosPorSemana(resultados);

		console.log(JSON.stringify({
			doenca,
			ingestao: contadores,
			totalNaCurva: curva.reduce((soma, item) => soma + item.total, 0),
			semanas: curva.length,
			curva,
		}, null, 2));
	}
}

main().catch(erro => {
	console.error("Erro durante a validação:", erro);
});
