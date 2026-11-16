const CAMPOS_SINTOMAS: Record<Doenca, readonly string[]> = {
	dengue: [
		"febre",
		"mialgia",
		"cefaleia",
		"exantema",
		"vomito",
		"nausea",
		"nauseas",
		"dor_costas",
		"conjuntvit",
		"artrite",
		"artralgia",
		"dor_retro",
		"diarreia",
		"dor",
		"prostacao",
		"outros",
	],
	chikungunya: [
		"febre",
		"mialgia",
		"cefaleia",
		"exantema",
		"vomito",
		"nausea",
		"dor_costas",
		"conjuntvit",
		"artrite",
		"artralgia",
	],
	zika: [],
};

/**
 * Converte valores ausentes da API em null.
 * Converte números para strings caso se aplique.
 *
 * A API pode representar dados ausentes como:
 * - null
 * - undefined
 * - ""
 * - "nan"
 */
export function normalizarNulo(valor: unknown): string | null {
	if (valor === null || valor === undefined) {
		return null;
	}

	if (typeof valor === "number") {
		if (!Number.isSafeInteger(valor)) {
			return null;
		}

		return String(valor);
	}

	if (typeof valor !== "string") {
		return null;
	}

	const normalizado = valor.trim();

	if (normalizado === "" || normalizado.toLowerCase() === "nan") {
		return null;
	}

	return normalizado;
}

/**
 * Normaliza uma data no formato YYYY-MM-DD.
 *
 * Retorna null para datas inválidas ou ausentes.
 */
export function normalizarData(valor: unknown): string | null {
    const texto = normalizarNulo(valor);

    if (texto === null) return null;

    const correspondencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);

    if (!correspondencia) return null;

    const ano = Number(correspondencia[1]);
    const mes = Number(correspondencia[2]);
    const dia = Number(correspondencia[3]);

    if (ano < 1 || mes < 1 || mes > 12) return null;

    const bissexto = ano % 400 === 0 || (ano % 4 === 0 && ano % 100 !== 0);

    const diasPorMes = [
        31,
        bissexto ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    if (dia < 1 || dia > diasPorMes[mes - 1]!) return null;

    return texto;
}

/**
 * Preserva identificadores como strings, inclusive zeros à esquerda.
 */
export function normalizarIdentificador(valor: unknown): string | null {
    return normalizarNulo(valor);
}

import type { Idade, SemanaEpidemiologica } from "./types.ts";

const unidadesIdade = {
    "1": "horas",
    "2": "dias",
    "3": "meses",
    "4": "anos",
} as const;

/**
 * Decodifica a idade no formato utilizado pelo SINAN.
 *
 * Exemplo:
 * "4023" -> { unidade: "anos", quantidade: 23 }
 */
export function normalizarIdade(valor: unknown): Idade | null {
    const texto = normalizarNulo(valor);

    if (texto === null || !/^[1-4]\d{3}$/.test(texto)) {
        return null;
    }

    const unidade = unidadesIdade[texto[0] as keyof typeof unidadesIdade];
    const quantidade = Number(texto.slice(1));

    return { unidade, quantidade };
}

/**
 * Retorna o domingo que inicia a primeira semana epidemiológica
 * de determinado ano.
 *
 * A semana que contém 4 de janeiro é sempre a primeira semana.
 */
function inicioPrimeiraSemana(ano: number): Date {
    const data = new Date(0);
    data.setUTCFullYear(ano, 0, 4);
    data.setUTCHours(0, 0, 0, 0);

    data.setUTCDate(data.getUTCDate() - data.getUTCDay());

    return data;
}

/**
 * Calcula a quantidade de semanas epidemiológicas de um ano.
 */
function quantidadeSemanas(ano: number): number {
    const inicioAtual = inicioPrimeiraSemana(ano);
    const inicioSeguinte = inicioPrimeiraSemana(ano + 1);

    const diferenca = inicioSeguinte.getTime() - inicioAtual.getTime();

    return diferenca / (7 * 24 * 60 * 60 * 1000);
}

/**
 * Normaliza uma semana epidemiológica no formato AAAASS.
 *
 * Exemplo:
 * "202616" -> { ano: 2026, semana: 16 }
 */
export function normalizarSemanaEpidemiologica(
    valor: unknown,
): SemanaEpidemiologica | null {
    const texto = normalizarNulo(valor);

    if (texto === null || !/^\d{6}$/.test(texto)) {
        return null;
    }

    const ano = Number(texto.slice(0, 4));
    const semana = Number(texto.slice(4));

    if (ano < 1 || semana < 1 || semana > quantidadeSemanas(ano)) {
        return null;
    }

    return { ano, semana };
}

import type {
    Doenca,
    NotificacaoNormalizada,
    RegistroBruto,
} from "./types.ts";

function normalizarInteiro(valor: unknown): number | null {
    const texto = normalizarNulo(valor);

    if (texto === null || !/^\d+$/.test(texto)) {
        return null;
    }

    const numero = Number(texto);

    return Number.isSafeInteger(numero) ? numero : null;
}

function normalizarSintomas(
	registro: RegistroBruto,
	doenca: Doenca,
): Record<string, string | null> | undefined {
	const campos = CAMPOS_SINTOMAS[doenca].filter(
		(campo) => Object.hasOwn(registro, campo),
	);

	if (campos.length === 0) {
		return undefined;
	}

	return Object.fromEntries(
		campos.map((campo) => [campo, normalizarNulo(registro[campo])]),
	);
}

export function normalizarNotificacao(
    registro: RegistroBruto,
    doenca: Doenca,
): NotificacaoNormalizada {
    return {
        doenca,

        anoNotificacao: normalizarInteiro(registro.nu_ano),
        anoNascimento: normalizarInteiro(registro.ano_nasc),

        dataNotificacao: normalizarData(registro.dt_notific),
        dataInicioSintomas: normalizarData(registro.dt_sin_pri),
        dataObito: normalizarData(registro.dt_obito),
        dataEncerramento: normalizarData(registro.dt_encerra),
        dataDigitacao: normalizarData(registro.dt_digita),

        semanaNotificacao: normalizarSemanaEpidemiologica(registro.sem_not),
        semanaInicioSintomas: normalizarSemanaEpidemiologica(registro.sem_pri),

        idade: normalizarIdade(registro.nu_idade_n),
        sexo: normalizarNulo(registro.cs_sexo),

        municipioNotificacao: normalizarIdentificador(registro.id_municip),
        municipioResidencia: normalizarIdentificador(registro.id_mn_resi),
        cnes: normalizarIdentificador(registro.id_unidade),

        classificacaoFinal: normalizarNulo(registro.classi_fin),
        criterioConfirmacao: normalizarNulo(registro.criterio),
        evolucao: normalizarNulo(registro.evolucao),

        ...(Object.hasOwn(registro, "hospitaliz")
			? { hospitalizacao: normalizarNulo(registro.hospitaliz) }
			: {}),

		...(normalizarSintomas(registro, doenca) !== undefined
			? { sintomas: normalizarSintomas(registro, doenca) }
			: {}),
    };
}