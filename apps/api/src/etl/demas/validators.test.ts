import { describe, expect, it } from "vitest";
import { normalizarNotificacao } from "./normalizers.ts";
import { validarNotificacao } from "./validators.ts";
import type { RegistroBruto } from "./types.ts";

const dataReferencia = "2026-11-15";

function validar(registro: RegistroBruto) {
    return validarNotificacao(
        registro,
        normalizarNotificacao(registro, "zika"),
        dataReferencia,
    );
}

describe("validarNotificacao", () => {
    it("não encontra problemas em um registro consistente", () => {
        const registro = {
            nu_ano: "2026",
            dt_notific: "2026-04-23",
            dt_sin_pri: "2026-04-11",
            sem_not: "202616",
            sem_pri: "202614",
            nu_idade_n: "4023",
            dt_obito: "nan",
            dt_encerra: "2026-05-07",
            dt_digita: "2026-04-27",
        };

        expect(validar(registro)).toEqual([]);
    });

    it("identifica datas inválidas", () => {
        const problemas = validar({
        dt_notific: "2026-02-30",
        });

        expect(problemas).toContainEqual(
            expect.objectContaining({
                campo: "dt_notific",
                codigo: "campo_invalido",
                severidade: "erro",
            }),
        );
    });

    it("identifica semanas epidemiológicas inválidas", () => {
        const problemas = validar({
        sem_not: "202653",
        });

        expect(problemas).toContainEqual(
        expect.objectContaining({
            campo: "sem_not",
            codigo: "campo_invalido",
        }),
        );
    });

    it("identifica idade com codificação inválida", () => {
        const problemas = validar({
        nu_idade_n: "5023",
        });

        expect(problemas).toContainEqual(
        expect.objectContaining({
            campo: "nu_idade_n",
            codigo: "campo_invalido",
        }),
        );
    });

    it("identifica datas futuras", () => {
        const problemas = validar({
        dt_notific: "2026-12-01",
        });

        expect(problemas).toContainEqual(
        expect.objectContaining({
            campo: "dt_notific",
            codigo: "data_futura",
        }),
        );
    });

    it("identifica inconsistências cronológicas", () => {
        const problemas = validar({
        dt_notific: "2026-04-10",
        dt_sin_pri: "2026-04-15",
        });

        expect(problemas).toContainEqual(
        expect.objectContaining({
            campo: "dt_sin_pri",
            codigo: "inconsistencia_temporal",
        }),
        );
    });

    it("não acusa campos opcionais ausentes", () => {
        expect(validar({})).toEqual([]);
    });
});