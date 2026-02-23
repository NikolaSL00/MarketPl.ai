from pathlib import Path
import argparse

import pandas as pd


def load_symbol_to_security_name(meta_csv_path: Path) -> dict[str, str]:
    meta = pd.read_csv(meta_csv_path, usecols=["Symbol", "Security Name", "NASDAQ Symbol"])

    symbol_map: dict[str, str] = {}
    for _, row in meta.iterrows():
        security_name = str(row.get("Security Name", "")).strip()

        symbol = str(row.get("Symbol", "")).strip()
        if symbol:
            symbol_map[symbol] = security_name

        nasdaq_symbol = str(row.get("NASDAQ Symbol", "")).strip()
        if nasdaq_symbol:
            symbol_map.setdefault(nasdaq_symbol, security_name)

    return symbol_map


def merge_stock_history(
    stocks_dir: Path,
    meta_csv_path: Path,
    output_csv_path: Path,
    limit: int | None = None,
) -> None:
    if not stocks_dir.exists() or not stocks_dir.is_dir():
        raise FileNotFoundError(f"Stocks directory not found: {stocks_dir}")

    if not meta_csv_path.exists():
        raise FileNotFoundError(f"Metadata file not found: {meta_csv_path}")

    symbol_to_name = load_symbol_to_security_name(meta_csv_path)

    stock_files = sorted(stocks_dir.glob("*.csv"))
    if limit is not None:
        stock_files = stock_files[:limit]

    if not stock_files:
        raise ValueError(f"No stock CSV files found in: {stocks_dir}")

    output_csv_path.parent.mkdir(parents=True, exist_ok=True)
    if output_csv_path.exists():
        output_csv_path.unlink()

    rows_written = 0

    for index, stock_file in enumerate(stock_files, start=1):
        symbol = stock_file.stem
        security_name = symbol_to_name.get(symbol, "")

        data = pd.read_csv(stock_file)
        if data.empty:
            continue

        data.insert(0, "Symbol", symbol)
        data.insert(1, "Security Name", security_name)

        data.to_csv(output_csv_path, mode="a", header=rows_written == 0, index=False)
        rows_written += len(data)

        if index % 500 == 0:
            print(f"Processed {index}/{len(stock_files)} files...")

    print(f"Done. Files processed: {len(stock_files)}")
    print(f"Total rows written: {rows_written}")
    print(f"Output: {output_csv_path.resolve()}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Merge all stock historical CSVs into one file and add Security Name from metadata."
    )
    parser.add_argument(
        "--stocks-dir",
        type=Path,
        default=Path("data/stock-market-dataset/stocks"),
        help="Path to folder containing per-symbol stock CSV files.",
    )
    parser.add_argument(
        "--meta-csv",
        type=Path,
        default=Path("data/stock-market-dataset/symbols_valid_meta.csv"),
        help="Path to symbols_valid_meta.csv file.",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=Path("data/stock-market-dataset/all_stocks_historical_with_names.csv"),
        help="Path for the merged output CSV file.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional: process only first N stock files for testing.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    merge_stock_history(
        stocks_dir=args.stocks_dir,
        meta_csv_path=args.meta_csv,
        output_csv_path=args.output_csv,
        limit=args.limit,
    )
