
import { describe, expect, it } from "vitest";
import { normalizarNotificacao } from "./normalizers.ts";
import {
	interpretarCriterioConfirmacao,
	interpretarEvolucao,
} from "./interpretations.ts";

describe("interpretarCriterioConfirmacao", () => {
	it.each([
		["1", "laboratorial"],
		["2", "clinico_epidemiologico"],
		["3", "em_investigacao"],
	] as const)(
		"interpreta critério %s",
		(codigo, categoria) => {
			const notificacao = normalizarNotificacao({
				criterio: codigo,
			}, "dengue");

			expect(interpretarCriterioConfirmacao(notificacao)).toEqual({
				codigo,
				categoria,
			});
		},
	);

	it("não interpreta códigos de critério de Zika sem mapeamento confirmado", () => {
		const notificacao = normalizarNotificacao({
			criterio: "1",
		}, "zika");

		expect(interpretarCriterioConfirmacao(notificacao)).toEqual({
			codigo: "1",
			categoria: "desconhecido",
		});
	});

	it("distingue critério ausente de desconhecido", () => {
		const notificacao = normalizarNotificacao({}, "dengue");

		expect(interpretarCriterioConfirmacao(notificacao)).toEqual({
			codigo: null,
			categoria: "nao_informado",
		});
	});

    it.each(["dengue", "chikungunya"] as const)(
        "interpreta critérios conhecidos de %s",
        (doenca) => {
            const casos = [
                ["1", "laboratorial"],
                ["2", "clinico_epidemiologico"],
                ["3", "em_investigacao"],
            ] as const;

            for (const [codigo, categoria] of casos) {
                const notificacao = normalizarNotificacao({
                    criterio: codigo,
                }, doenca);

                expect(interpretarCriterioConfirmacao(notificacao)).toEqual({
                    codigo,
                    categoria,
                });
            }
        },
    );
});

describe("interpretarEvolucao", () => {
	it.each([
		["1", "cura"],
		["2", "obito_pelo_agravo"],
		["3", "obito_outra_causa"],
		["4", "obito_em_investigacao"],
		["9", "ignorado"],
	] as const)(
		"interpreta evolução %s",
		(codigo, categoria) => {
			const notificacao = normalizarNotificacao({
				evolucao: codigo,
			}, "dengue");

			expect(interpretarEvolucao(notificacao)).toEqual({
				codigo,
				categoria,
			});
		},
	);

	it("não interpreta evolução de Zika sem mapeamento confirmado", () => {
		const notificacao = normalizarNotificacao({
			evolucao: "1",
		}, "zika");

		expect(interpretarEvolucao(notificacao)).toEqual({
			codigo: "1",
			categoria: "desconhecido",
		});
	});

	it("distingue evolução ausente de desconhecida", () => {
		const notificacao = normalizarNotificacao({}, "chikungunya");

		expect(interpretarEvolucao(notificacao)).toEqual({
			codigo: null,
			categoria: "nao_informado",
		});
	});
});
