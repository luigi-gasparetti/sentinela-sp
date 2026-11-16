import { describe, expect, it, vi } from "vitest";
import { ingerirNotificacoes } from "./pipeline.ts";

describe("ingerirNotificacoes", () => {
	it("busca e normaliza notificações", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({
				dengue: [{
					nu_ano: "2025",
					dt_notific: "2025-03-10",
					dt_sin_pri: "2025-03-05",
					sem_not: "202511",
					sem_pri: "202510",
					nu_idade_n: "4051",
					cs_sexo: "M",
					id_municip: "355030",
					id_unidade: "1234567",
				}],
			}), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const resultados = [];

		for await (const resultado of ingerirNotificacoes(
			"dengue",
			{
				municipioNotificacao: "355030",
				dataReferencia: "2025-12-31",
			},
			fetcher,
		)) {
			resultados.push(resultado);
		}

		expect(resultados).toHaveLength(1);

		expect(resultados[0]!.notificacao).toMatchObject({
			doenca: "dengue",
			anoNotificacao: 2025,
			dataNotificacao: "2025-03-10",
			dataInicioSintomas: "2025-03-05",
			idade: {
				unidade: "anos",
				quantidade: 51,
			},
			municipioNotificacao: "355030",
			cnes: "1234567",
		});

		expect(resultados[0]!.problemas).toEqual([]);
	});

	it("preserva registros que possuem problemas de validação", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({
				dengue: [{
					dt_notific: "2025-03-10",
					dt_sin_pri: "2025-03-20",
					nu_idade_n: "4051",
				}],
			}), { status: 200 }),
		);

		const resultados = [];

		for await (const resultado of ingerirNotificacoes(
			"dengue",
			{
				municipioNotificacao: "355030",
				dataReferencia: "2025-12-31",
			},
			fetcher,
		)) {
			resultados.push(resultado);
		}

		expect(resultados).toHaveLength(1);
		expect(resultados[0]!.problemas).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					campo: "dt_sin_pri",
					severidade: "aviso",
				}),
			]),
		);
	});

	it("retorna fluxo vazio quando a API não possui registros", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ dengue: [] }), {
				status: 200,
			}),
		);

		const resultados = [];

		for await (const resultado of ingerirNotificacoes(
			"dengue",
			{
				municipioNotificacao: "355030",
				dataReferencia: "2025-12-31",
			},
			fetcher,
		)) {
			resultados.push(resultado);
		}

		expect(resultados).toEqual([]);
	});
});
