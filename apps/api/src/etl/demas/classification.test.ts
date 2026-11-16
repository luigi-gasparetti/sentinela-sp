
import { describe, expect, it } from "vitest";
import { normalizarNotificacao } from "./normalizers.ts";
import { interpretarClassificacaoFinal } from "./classification.ts";

describe("interpretarClassificacaoFinal", () => {
	it.each([
		["10", "dengue", "confirmado", true],
		["11", "dengue_com_sinais_de_alarme", "confirmado", true],
		["12", "dengue_grave", "confirmado", true],
		["5", "descartado", "descartado", false],
		["8", "inconclusivo", "nao_descartado", true],
	] as const)(
		"interpreta classificação de dengue %s",
		(codigo, categoria, situacao, elegivel) => {
			const notificacao = normalizarNotificacao({
				classi_fin: codigo,
			}, "dengue");

			expect(interpretarClassificacaoFinal(notificacao)).toEqual({
				codigo,
				categoria,
				situacao,
				elegivelParaContagemDeProvaveis: elegivel,
			});
		},
	);

	it.each([
		["13", "chikungunya", "confirmado", true],
		["5", "descartado", "descartado", false],
	] as const)(
		"interpreta classificação de chikungunya %s",
		(codigo, categoria, situacao, elegivel) => {
			const notificacao = normalizarNotificacao({
				classi_fin: codigo,
			}, "chikungunya");

			expect(interpretarClassificacaoFinal(notificacao)).toMatchObject({
				codigo,
				categoria,
				situacao,
				elegivelParaContagemDeProvaveis: elegivel,
			});
		},
	);

	it.each([
		["1", "zika", "confirmado", true],
		["2", "descartado", "descartado", false],
	] as const)(
		"interpreta classificação de Zika %s",
		(codigo, categoria, situacao, elegivel) => {
			const notificacao = normalizarNotificacao({
				classi_fin: codigo,
			}, "zika");

			expect(interpretarClassificacaoFinal(notificacao)).toMatchObject({
				codigo,
				categoria,
				situacao,
				elegivelParaContagemDeProvaveis: elegivel,
			});
		},
	);

	it("não atribui significado não confirmado ao código 8 da Zika", () => {
		const notificacao = normalizarNotificacao({
			classi_fin: "8",
		}, "zika");

		expect(interpretarClassificacaoFinal(notificacao)).toEqual({
			codigo: "8",
			categoria: "desconhecido",
			situacao: "indeterminado",
			elegivelParaContagemDeProvaveis: null,
		});
	});

	it("não considera classificação ausente como caso provável", () => {
		const notificacao = normalizarNotificacao({}, "dengue");

		expect(interpretarClassificacaoFinal(notificacao)).toEqual({
			codigo: null,
			categoria: "nao_informado",
			situacao: "indeterminado",
			elegivelParaContagemDeProvaveis: null,
		});
	});

	it("não atribui significado a códigos desconhecidos", () => {
		const notificacao = normalizarNotificacao({
			classi_fin: "99",
		}, "dengue");

		expect(interpretarClassificacaoFinal(notificacao)).toEqual({
			codigo: "99",
			categoria: "desconhecido",
			situacao: "indeterminado",
			elegivelParaContagemDeProvaveis: null,
		});
	});
});
