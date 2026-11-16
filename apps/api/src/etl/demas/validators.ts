import type {
    NotificacaoNormalizada,
    RegistroBruto,
} from "./types.ts";

import {
    normalizarData,
    normalizarNulo,
    normalizarSemanaEpidemiologica,
    normalizarIdade,
} from "./normalizers.ts";

export type Severidade = "erro" | "aviso";

export interface ProblemaValidacao {
    campo: string;
    codigo: string;
    severidade: Severidade;
    mensagem: string;
}

function adicionarProblema(
    problemas: ProblemaValidacao[],
    campo: string,
    codigo: string,
    severidade: Severidade,
    mensagem: string,
): void {
    problemas.push({ campo, codigo, severidade, mensagem });
}

export function validarNotificacao(
    registro: RegistroBruto,
    notificacao: NotificacaoNormalizada,
    dataReferencia: string,
): ProblemaValidacao[] {
    const problemas: ProblemaValidacao[] = [];

    const camposData = [
        "dt_notific",
        "dt_sin_pri",
        "dt_obito",
        "dt_encerra",
        "dt_digita",
    ] as const;

    // Datas preenchidas que não puderam ser interpretadas.
    for (const campo of camposData) {
        const valor = normalizarNulo(registro[campo]);

        if (valor !== null && normalizarData(valor) === null) {
            adicionarProblema(
                problemas,
                campo,
                "campo_invalido",
                "erro",
                `Data inválida: ${valor}`,
            );
        }
    }

    // Semanas epidemiológicas preenchidas, mas inválidas.
    for (const campo of ["sem_not", "sem_pri"] as const) {
        const valor = normalizarNulo(registro[campo]);

        if (
            valor !== null &&
            normalizarSemanaEpidemiologica(valor) === null
        ) {
            adicionarProblema(
                problemas,
                campo,
                "campo_invalido",
                "erro",
                `Semana epidemiológica inválida: ${valor}`,
            );
        }
    }

    // Idades preenchidas, mas com codificação inválida.
    const idadeBruta = normalizarNulo(registro.nu_idade_n);

    if (idadeBruta !== null && normalizarIdade(idadeBruta) === null) {
        adicionarProblema(
            problemas,
            "nu_idade_n",
            "campo_invalido",
            "aviso",
            `Idade com codificação inválida: ${idadeBruta}`,
        );
    }

    // Datas posteriores à referência da ingestão.
    const datas = [
        ["dt_notific", notificacao.dataNotificacao],
        ["dt_sin_pri", notificacao.dataInicioSintomas],
        ["dt_obito", notificacao.dataObito],
        ["dt_encerra", notificacao.dataEncerramento],
        ["dt_digita", notificacao.dataDigitacao],
    ] as const;

    for (const [campo, data] of datas) {
        if (data !== null && data > dataReferencia) {
            adicionarProblema(
                problemas,
                campo,
                "data_futura",
                "aviso",
                `Data posterior à referência da ingestão (${dataReferencia}): ${data}`,
            );
        }
    }

    // Inconsistências cronológicas.
    const inicio = notificacao.dataInicioSintomas;
    const notificacaoData = notificacao.dataNotificacao;
    const obito = notificacao.dataObito;
    const encerramento = notificacao.dataEncerramento;

    if (
        inicio !== null &&
        notificacaoData !== null &&
        inicio > notificacaoData
    ) {
        adicionarProblema(
        problemas,
        "dt_sin_pri",
        "inconsistencia_temporal",
        "aviso",
        "Início dos sintomas posterior à data de notificação.",
        );
    }

    if (inicio !== null && obito !== null && obito < inicio) {
        adicionarProblema(
        problemas,
        "dt_obito",
        "inconsistencia_temporal",
        "aviso",
        "Data de óbito anterior ao início dos sintomas.",
        );
    }

    if (
        notificacaoData !== null &&
        encerramento !== null &&
        encerramento < notificacaoData
    ) {
        adicionarProblema(
        problemas,
        "dt_encerra",
        "inconsistencia_temporal",
        "aviso",
        "Data de encerramento anterior à data de notificação.",
        );
    }

    return problemas;
}