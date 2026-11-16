/**
 * Representa um registro bruto recebido da API do DEMAS.
 *
 * Os campos da API são majoritariamente strings, mas usamos
 * unknown porque os dados externos ainda não foram validados.
 */
export type RegistroBruto = Record<string, unknown>;

export type UnidadeIdade = "horas" | "dias" | "meses" | "anos";

export interface Idade {
    unidade: UnidadeIdade;
    quantidade: number;
}

export interface SemanaEpidemiologica {
    ano: number;
    semana: number;
}

export type Doenca = "dengue" | "chikungunya" | "zika";

/**
 * Representa um registro após a normalização dos campos
 * que serão utilizados pela aplicação.
 */
export interface NotificacaoNormalizada {
    doenca: Doenca;

    anoNotificacao: number | null;
    anoNascimento: number | null;

    dataNotificacao: string | null;
    dataInicioSintomas: string | null;
    dataObito: string | null;
    dataEncerramento: string | null;
    dataDigitacao: string | null;

    semanaNotificacao: SemanaEpidemiologica | null;
    semanaInicioSintomas: SemanaEpidemiologica | null;

    idade: Idade | null;
    sexo: string | null;

    municipioNotificacao: string | null;
    municipioResidencia: string | null;
    cnes: string | null;

    classificacaoFinal: string | null;
    criterioConfirmacao: string | null;
    evolucao: string | null;

    hospitalizacao?: string | null;
	sintomas?: Record<string, string | null>;
}