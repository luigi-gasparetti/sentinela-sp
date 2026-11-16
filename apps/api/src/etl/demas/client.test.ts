import { describe, expect, it, vi } from "vitest";
import { iterarNotificacoes } from "./client.ts";

function resposta(registros: unknown[], chave = "dengue"): Response {
	return new Response(JSON.stringify({ [chave]: registros }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

async function coletar(
	iterador: AsyncGenerator<Record<string, unknown>>,
): Promise<Record<string, unknown>[]> {
	const registros = [];

	for await (const registro of iterador) {
		registros.push(registro);
	}

	return registros;
}

describe("iterarNotificacoes", () => {
	it("consulta o endpoint e retorna os registros", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			resposta([{ nu_ano: "2025" }]),
		);

		const registros = await coletar(
			iterarNotificacoes("dengue", {
				municipioNotificacao: "355030",
			}, fetcher),
		);

		expect(registros).toEqual([{ nu_ano: "2025" }]);
		expect(fetcher).toHaveBeenCalledOnce();

		const url = new URL(String(fetcher.mock.calls[0]![0]));

		expect(url.pathname).toBe("/arboviroses/dengue");
		expect(url.searchParams.get("id_municip")).toBe("355030");
		expect(url.searchParams.get("limit")).toBe("1000");
		expect(url.searchParams.get("offset")).toBe("0");
	});

	it("consulta páginas consecutivas até encontrar uma página incompleta", async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(
                resposta([{ id: 1 }, { id: 2 }]),
            )
            .mockResolvedValueOnce(
                resposta([{ id: 3 }, { id: 4 }]),
            )
            .mockResolvedValueOnce(
                resposta([{ id: 5 }]),
            );

        const registros = await coletar(
            iterarNotificacoes("dengue", {
                municipioNotificacao: "355030",
                limitePagina: 2,
            }, fetcher),
        );

        expect(registros).toEqual([
            { id: 1 },
            { id: 2 },
            { id: 3 },
            { id: 4 },
            { id: 5 },
        ]);

        expect(fetcher).toHaveBeenCalledTimes(3);

        const offsets = fetcher.mock.calls.map(([input]) => {
            const url = new URL(String(input));
            return url.searchParams.get("offset");
        });

        expect(offsets).toEqual(["0", "1", "2"]);
    });

	it("utiliza o endpoint correto para zika", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			resposta([{ nu_ano: "2025" }], "zikavirus"),
		);

		await coletar(
			iterarNotificacoes("zika", {
				municipioNotificacao: "355030",
			}, fetcher),
		);

		const url = new URL(String(fetcher.mock.calls[0]![0]));

		expect(url.pathname).toBe("/arboviroses/zikavirus");
	});

	it("rejeita limites inválidos", async () => {
		const fetcher = vi.fn<typeof fetch>();

		await expect(
			coletar(
				iterarNotificacoes("dengue", {
					municipioNotificacao: "355030",
					limitePagina: 1001,
				}, fetcher),
			),
		).rejects.toThrow(RangeError);

		expect(fetcher).not.toHaveBeenCalled();
	});

	it("rejeita respostas HTTP malsucedidas", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(null, { status: 500 }),
		);

		await expect(
			coletar(
				iterarNotificacoes("dengue", {
					municipioNotificacao: "355030",
				}, fetcher),
			),
		).rejects.toThrow("HTTP 500");
	});

	it("rejeita respostas sem a lista esperada", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(JSON.stringify({ dados: [] }), {
				status: 200,
			}),
		);

		await expect(
			coletar(
				iterarNotificacoes("dengue", {
					municipioNotificacao: "355030",
				}, fetcher),
			),
		).rejects.toThrow("lista válida");
	});
});


it("faz uma última consulta quando a quantidade de registros é exatamente o limite", async () => {
	const fetcher = vi.fn<typeof fetch>()
		.mockResolvedValueOnce(
			resposta([
				{ id: "1" },
				{ id: "2" },
			]),
		)
		.mockResolvedValueOnce(resposta([]));

	const registros = await coletar(
		iterarNotificacoes(
			"dengue",
			{
				municipioNotificacao: "355030",
				limitePagina: 2,
			},
			fetcher,
		),
	);

	expect(registros).toHaveLength(2);
	expect(fetcher).toHaveBeenCalledTimes(2);

	const primeiraUrl = new URL(String(fetcher.mock.calls[0]![0]));
	const segundaUrl = new URL(String(fetcher.mock.calls[1]![0]));

	expect(primeiraUrl.searchParams.get("offset")).toBe("0");
	expect(segundaUrl.searchParams.get("offset")).toBe("1");
});
