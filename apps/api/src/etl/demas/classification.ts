
import type { NotificacaoNormalizada } from "./types.ts";

export type SituacaoEpidemiologica =
	| "confirmado"
	| "descartado"
	| "nao_descartado"
	| "indeterminado";

export type CategoriaClassificacao =
	| "dengue"
	| "dengue_com_sinais_de_alarme"
	| "dengue_grave"
	| "chikungunya"
	| "zika"
	| "descartado"
	| "inconclusivo"
	| "nao_informado"
	| "desconhecido";

export interface InterpretacaoClassificacao {
	codigo: string | null;
	categoria: CategoriaClassificacao;
	situacao: SituacaoEpidemiologica;
	elegivelParaContagemDeProvaveis: boolean | null;
}

interface RegraClassificacao {
	categoria: CategoriaClassificacao;
	situacao: SituacaoEpidemiologica;
}

const REGRAS_CLASSIFICACAO: Record<
	NotificacaoNormalizada["doenca"],
	Record<string, RegraClassificacao>
> = {
	dengue: {
		"5": {
			categoria: "descartado",
			situacao: "descartado",
		},
		"8": {
			categoria: "inconclusivo",
			situacao: "nao_descartado",
		},
		"10": {
			categoria: "dengue",
			situacao: "confirmado",
		},
		"11": {
			categoria: "dengue_com_sinais_de_alarme",
			situacao: "confirmado",
		},
		"12": {
			categoria: "dengue_grave",
			situacao: "confirmado",
		},
	},
	chikungunya: {
		"5": {
			categoria: "descartado",
			situacao: "descartado",
		},
		"13": {
			categoria: "chikungunya",
			situacao: "confirmado",
		},
	},
	zika: {
		"1": {
			categoria: "zika",
			situacao: "confirmado",
		},
		"2": {
			categoria: "descartado",
			situacao: "descartado",
		},
	},
};

export function interpretarClassificacaoFinal(
	notificacao: NotificacaoNormalizada,
): InterpretacaoClassificacao {
	const codigo = notificacao.classificacaoFinal;

	if (codigo === null) {
		return {
			codigo: null,
			categoria: "nao_informado",
			situacao: "indeterminado",
			elegivelParaContagemDeProvaveis: null,
		};
	}

	const regra = REGRAS_CLASSIFICACAO[notificacao.doenca][codigo];

	if (regra === undefined) {
		return {
			codigo,
			categoria: "desconhecido",
			situacao: "indeterminado",
			elegivelParaContagemDeProvaveis: null,
		};
	}

	return {
		codigo,
		...regra,
		elegivelParaContagemDeProvaveis:
			regra.situacao === "confirmado" ||
			regra.situacao === "nao_descartado"
				? true
				: regra.situacao === "descartado"
					? false
					: null,
	};
}
