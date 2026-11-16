import { describe, expect, it } from "vitest";
import {
    normalizarData,
    normalizarIdentificador,
    normalizarNulo,
} from "./normalizers.ts";

describe("normalizarNulo", () => {
    it("converte valores ausentes em null", () => {
        expect(normalizarNulo(null)).toBeNull();
        expect(normalizarNulo(undefined)).toBeNull();
        expect(normalizarNulo("")).toBeNull();
        expect(normalizarNulo("nan")).toBeNull();
        expect(normalizarNulo("NaN")).toBeNull();
    });

    it("remove espaços excedentes", () => {
        expect(normalizarNulo("  ABC  ")).toBe("ABC");
    });

    it("converte números inteiros em strings", () => {
        expect(normalizarNulo(355030)).toBe("355030");
        expect(normalizarNulo(4021.0)).toBe("4021");
    });

    it("rejeita números não inteiros", () => {
        expect(normalizarNulo(4021.5)).toBeNull();
    });

    it("rejeita valores que não são strings ou números inteiros", () => {
        expect(normalizarNulo(true)).toBeNull();
        expect(normalizarNulo({})).toBeNull();
    });
});

describe("normalizarData", () => {
    it("aceita datas válidas", () => {
        expect(normalizarData("2026-04-23")).toBe("2026-04-23");
        expect(normalizarData("2024-02-29")).toBe("2024-02-29");
    });

    it("rejeita datas inválidas", () => {
        expect(normalizarData("2026-02-29")).toBeNull();
        expect(normalizarData("2026-02-30")).toBeNull();
        expect(normalizarData("2026-13-01")).toBeNull();
        expect(normalizarData("23/04/2026")).toBeNull();
    });

    it("trata valores ausentes", () => {
        expect(normalizarData("nan")).toBeNull();
        expect(normalizarData(null)).toBeNull();
    });
});

describe("normalizarIdentificador", () => {
    it("preserva zeros à esquerda", () => {
        expect(normalizarIdentificador("00711606")).toBe("00711606");
    });

    it("normaliza identificadores numéricos", () => {
        expect(normalizarIdentificador(355030)).toBe("355030");
    });
});

import {
    normalizarIdade,
    normalizarSemanaEpidemiologica,
} from "./normalizers.ts";

describe("normalizarIdade", () => {
    it("decodifica todas as unidades", () => {
        expect(normalizarIdade("1005")).toEqual({
            unidade: "horas",
            quantidade: 5,
        });

        expect(normalizarIdade("2012")).toEqual({
            unidade: "dias",
            quantidade: 12,
        });

        expect(normalizarIdade("3009")).toEqual({
            unidade: "meses",
            quantidade: 9,
        });

        expect(normalizarIdade("4023")).toEqual({
            unidade: "anos",
            quantidade: 23,
        });
    });

    it("decodifica idade recebida como número", () => {
        expect(normalizarIdade(4021)).toEqual({
            unidade: "anos",
            quantidade: 21,
        });
    });

    it("rejeita valores inválidos", () => {
        expect(normalizarIdade("")).toBeNull();
        expect(normalizarIdade("nan")).toBeNull();
        expect(normalizarIdade("5023")).toBeNull();
        expect(normalizarIdade("423")).toBeNull();
        expect(normalizarIdade("40234")).toBeNull();
    });
});

describe("normalizarSemanaEpidemiologica", () => {
    it("decodifica semanas válidas", () => {
        expect(normalizarSemanaEpidemiologica("202616")).toEqual({
        ano: 2026,
        semana: 16,
        });
    });

    it("aceita anos com 52 ou 53 semanas", () => {
        expect(normalizarSemanaEpidemiologica("202652")).toEqual({
        ano: 2026,
        semana: 52,
        });

        expect(normalizarSemanaEpidemiologica("202053")).toEqual({
        ano: 2020,
        semana: 53,
        });
    });

    it("rejeita semanas inexistentes", () => {
        expect(normalizarSemanaEpidemiologica("202653")).toBeNull();
        expect(normalizarSemanaEpidemiologica("202600")).toBeNull();
        expect(normalizarSemanaEpidemiologica("202654")).toBeNull();
    });

    it("rejeita formatos inválidos", () => {
        expect(normalizarSemanaEpidemiologica("2026")).toBeNull();
        expect(normalizarSemanaEpidemiologica("2026-16")).toBeNull();
        expect(normalizarSemanaEpidemiologica("nan")).toBeNull();
    });
});

import { normalizarNotificacao } from "./normalizers.ts";

describe("normalizarNotificacao", () => {
    it("normaliza um registro completo", () => {
        const registro = {
        nu_ano: "2026",
        ano_nasc: "2002",
        dt_notific: "2026-04-23",
        dt_sin_pri: "2026-04-11",
        sem_not: "202616",
        sem_pri: "202614",
        nu_idade_n: "4023",
        cs_sexo: "F",
        id_municip: "355030",
        id_mn_resi: "355030",
        id_unidade: "2077485",
        classi_fin: "2",
        criterio: "1",
        evolucao: "1",
        dt_obito: "nan",
        dt_encerra: "2026-05-07",
        dt_digita: "2026-04-27",
        };

        expect(normalizarNotificacao(registro, "zika")).toEqual({
        doenca: "zika",

        anoNotificacao: 2026,
        anoNascimento: 2002,

        dataNotificacao: "2026-04-23",
        dataInicioSintomas: "2026-04-11",
        dataObito: null,
        dataEncerramento: "2026-05-07",
        dataDigitacao: "2026-04-27",

        semanaNotificacao: { ano: 2026, semana: 16 },
        semanaInicioSintomas: { ano: 2026, semana: 14 },

        idade: { unidade: "anos", quantidade: 23 },
        sexo: "F",

        municipioNotificacao: "355030",
        municipioResidencia: "355030",
        cnes: "2077485",

        classificacaoFinal: "2",
        criterioConfirmacao: "1",
        evolucao: "1",
        });
    });

    it("preserva campos ausentes como null", () => {
        const registro = {};

        const resultado = normalizarNotificacao(registro, "dengue");

        expect(resultado.anoNotificacao).toBeNull();
        expect(resultado.idade).toBeNull();
        expect(resultado.dataNotificacao).toBeNull();
        expect(resultado.cnes).toBeNull();
    });

    it("normaliza hospitalização e sintomas da dengue", () => {
        const notificacao = normalizarNotificacao({
            hospitaliz: "1",
            febre: "1",
            mialgia: "2",
            cefaleia: "nan",
        }, "dengue");

        expect(notificacao.hospitalizacao).toBe("1");
        expect(notificacao.sintomas).toEqual({
            febre: "1",
            mialgia: "2",
            cefaleia: null,
        });
    });

    it("normaliza campos clínicos numéricos da chikungunya", () => {
        const notificacao = normalizarNotificacao({
            hospitaliz: 1,
            febre: 1,
            artralgia: 2,
        }, "chikungunya");

        expect(notificacao.hospitalizacao).toBe("1");
        expect(notificacao.sintomas).toEqual({
            febre: "1",
            artralgia: "2",
        });
    });

    it("não inventa campos clínicos para zika", () => {
        const notificacao = normalizarNotificacao({
            classi_fin: "2",
            criterio: "1",
        }, "zika");

        expect(notificacao).not.toHaveProperty("hospitalizacao");
        expect(notificacao).not.toHaveProperty("sintomas");
    });
});