
import type { NotificacaoNormalizada } from "./types.ts";

export type CategoriaCriterio =
	| "laboratorial"
	| "clinico_epidemiologico"
	| "em_investigacao"
	| "nao_informado"
	| "desconhecido";

export type CategoriaEvolucao =
	| "cura"
	| "obito_pelo_agravo"
	| "obito_outra_causa"
	| "obito_em_investigacao"
	| "ignorado"
	| "nao_informado"
	| "desconhecido";

export interface InterpretacaoCampo<T extends string> {
	codigo: string | null;
	categoria: T;
}

const CRITERIOS: Record<string, CategoriaCriterio> = {
	"1": "laboratorial",
	"2": "clinico_epidemiologico",
	"3": "em_investigacao",
};

const EVOLUCOES: Record<string, CategoriaEvolucao> = {
	"1": "cura",
	"2": "obito_pelo_agravo",
	"3": "obito_outra_causa",
	"4": "obito_em_investigacao",
	"9": "ignorado",
};

function interpretarCampo<T extends string>(
	codigo: string | null,
	mapeamento: Record<string, T>,
	naoInformado: T,
	desconhecido: T,
): InterpretacaoCampo<T> {
	if (codigo === null) {
		return { codigo: null, categoria: naoInformado };
	}

	return {
		codigo,
		categoria: mapeamento[codigo] ?? desconhecido,
	};
}

export function interpretarCriterioConfirmacao(
	notificacao: NotificacaoNormalizada,
): InterpretacaoCampo<CategoriaCriterio> {
	return interpretarCampo(
		notificacao.criterioConfirmacao,
		notificacao.doenca === "zika" ? {} : CRITERIOS,
		"nao_informado",
		"desconhecido",
	);
}

export function interpretarEvolucao(
	notificacao: NotificacaoNormalizada,
): InterpretacaoCampo<CategoriaEvolucao> {
	return interpretarCampo(
		notificacao.evolucao,
		notificacao.doenca === "zika" ? {} : EVOLUCOES,
		"nao_informado",
		"desconhecido",
	);
}
