
import type { Doenca, NotificacaoNormalizada } from "./types.ts";
import type { ResultadoProcessamento } from "./processor.ts";
import { interpretarClassificacaoFinal } from "./classification.ts";

const MUNICIPIO_ALVO = "355030";

export interface CasosPorSemana {
	doenca: Doenca;
	ano: number;
	semana: number;
	total: number;
}

export interface CasosPorSemanaEUnidade {
	doenca: Doenca;
	ano: number;
	semana: number;
	cnes: string | null;
	total: number;
}

async function* iterarNotificacoesElegiveis(
	resultados: AsyncIterable<ResultadoProcessamento>,
): AsyncGenerator<NotificacaoNormalizada> {
	for await (const resultado of resultados) {
		const notificacao = resultado.notificacao;

		if (!pertenceAoMunicipio(notificacao)) {
			continue;
		}

		if (!possuiSemanaValida(notificacao)) {
			continue;
		}

		const classificacao = interpretarClassificacaoFinal(notificacao);

		if (classificacao.situacao === "descartado") {
			continue;
		}

		yield notificacao;
	}
}

export async function agregarCasosPorSemana(
	resultados: AsyncIterable<ResultadoProcessamento>,
): Promise<CasosPorSemana[]> {
	const totais = new Map<string, CasosPorSemana>();

	for await (const notificacao of iterarNotificacoesElegiveis(resultados)) {
		const { doenca } = notificacao;
		const { ano, semana } = notificacao.semanaInicioSintomas!;

		const chave = `${doenca}:${ano}:${semana}`;
		const existente = totais.get(chave);

		if (existente !== undefined) {
			existente.total++;
		} else {
			totais.set(chave, {
				doenca,
				ano,
				semana,
				total: 1,
			});
		}
	}

	return [...totais.values()].sort((a, b) =>
		a.doenca.localeCompare(b.doenca) ||
		a.ano - b.ano ||
		a.semana - b.semana,
	);
}

export async function agregarCasosPorSemanaEUnidade(
	resultados: AsyncIterable<ResultadoProcessamento>,
): Promise<CasosPorSemanaEUnidade[]> {
	const totais = new Map<string, CasosPorSemanaEUnidade>();

	for await (const notificacao of iterarNotificacoesElegiveis(resultados)) {
		const { doenca, cnes } = notificacao;
		const { ano, semana } = notificacao.semanaInicioSintomas!;

		const chave = `${doenca}:${ano}:${semana}:${cnes ?? "sem-cnes"}`;
		const existente = totais.get(chave);

		if (existente !== undefined) {
			existente.total++;
		} else {
			totais.set(chave, {
				doenca,
				ano,
				semana,
				cnes,
				total: 1,
			});
		}
	}

	return [...totais.values()].sort((a, b) =>
		a.doenca.localeCompare(b.doenca) ||
		a.ano - b.ano ||
		a.semana - b.semana ||
		(a.cnes ?? "").localeCompare(b.cnes ?? ""),
	);
}

function pertenceAoMunicipio(
	notificacao: NotificacaoNormalizada,
): boolean {
	return notificacao.municipioNotificacao === MUNICIPIO_ALVO;
}

function possuiSemanaValida(
	notificacao: NotificacaoNormalizada,
): notificacao is NotificacaoNormalizada & {
	semanaInicioSintomas: NonNullable<
		NotificacaoNormalizada["semanaInicioSintomas"]
	>;
} {
	return notificacao.semanaInicioSintomas !== null;
}
