import { describe, expect, it } from "vitest";
import { processarNotificacao } from "./processor.ts";

describe("processarNotificacao", () => {
    it("normaliza e valida um registro consistente", () => {
        const registro = {
        nu_ano: "2026",
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

        const resultado = processarNotificacao(
            registro,
            "zika",
            "2026-11-15",
        );

        expect(resultado.notificacao.doenca).toBe("zika");
        expect(resultado.notificacao.idade).toEqual({
            unidade: "anos",
            quantidade: 23,
        });
        expect(resultado.notificacao.cnes).toBe("2077485");
        expect(resultado.problemas).toEqual([]);
    });

    it("preserva a notificação mesmo quando há problemas", () => {
        const registro = {
            dt_notific: "2026-02-30",
            dt_sin_pri: "2026-04-15",
            nu_idade_n: "5023",
        };

        const resultado = processarNotificacao(
            registro,
            "dengue",
            "2026-11-15",
        );

        expect(resultado.notificacao.doenca).toBe("dengue");
        expect(resultado.notificacao.dataNotificacao).toBeNull();
        expect(resultado.notificacao.idade).toBeNull();

        expect(resultado.problemas).toHaveLength(2);
        expect(resultado.problemas.map((p) => p.codigo)).toContain(
            "campo_invalido",
        );
        expect(resultado.problemas.map((p) => p.campo)).toContain(
            "dt_notific",
        );
        expect(resultado.problemas.map((p) => p.campo)).toContain(
            "nu_idade_n",
        );
    });

    it("rejeita uma data de referência inválida", () => {
        expect(() =>
            processarNotificacao({}, "dengue", "2026-02-30"),
        ).toThrow(RangeError);
    });
});