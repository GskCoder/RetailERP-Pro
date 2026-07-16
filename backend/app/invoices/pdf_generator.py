"""PDF Invoice Generator using ReportLab with QR code support."""
import os
import io
import qrcode
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT


def _number_to_words(num: float) -> str:
    """Convert a number to Indian English words for invoice total."""
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def _convert_below_thousand(n):
        if n == 0:
            return ''
        elif n < 20:
            return ones[n]
        elif n < 100:
            return tens[n // 10] + (' ' + ones[n % 10] if n % 10 else '')
        else:
            return ones[n // 100] + ' Hundred' + (' and ' + _convert_below_thousand(n % 100) if n % 100 else '')

    if num == 0:
        return 'Zero Rupees Only'

    rupees = int(num)
    paise = round((num - rupees) * 100)

    # Indian numbering: crore, lakh, thousand
    parts = []
    if rupees >= 10000000:
        parts.append(_convert_below_thousand(rupees // 10000000) + ' Crore')
        rupees %= 10000000
    if rupees >= 100000:
        parts.append(_convert_below_thousand(rupees // 100000) + ' Lakh')
        rupees %= 100000
    if rupees >= 1000:
        parts.append(_convert_below_thousand(rupees // 1000) + ' Thousand')
        rupees %= 1000
    if rupees > 0:
        parts.append(_convert_below_thousand(rupees))

    result = ' '.join(parts) + ' Rupees'
    if paise > 0:
        result += ' and ' + _convert_below_thousand(paise) + ' Paise'
    result += ' Only'
    return result


def _generate_qr_code(data: str) -> io.BytesIO:
    """Generate a QR code image as BytesIO."""
    qr = qrcode.QRCode(version=1, box_size=4, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer


def generate_invoice_pdf(sale, items, shop_settings, customer=None) -> io.BytesIO:
    """Generate a complete A4 invoice PDF.

    Args:
        sale: Sale object with all fields
        items: List of SaleItem objects
        shop_settings: ShopSettings object
        customer: Customer object (optional, for walk-in)

    Returns:
        BytesIO buffer containing the PDF
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Custom styles
    title_style = ParagraphStyle(
        'InvoiceTitle', parent=styles['Heading1'],
        fontSize=18, alignment=TA_CENTER, spaceAfter=2 * mm,
        textColor=colors.HexColor('#1e293b'),
    )
    subtitle_style = ParagraphStyle(
        'Subtitle', parent=styles['Normal'],
        fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor('#64748b'),
    )
    header_style = ParagraphStyle(
        'Header', parent=styles['Normal'],
        fontSize=10, textColor=colors.HexColor('#334155'),
    )
    bold_style = ParagraphStyle(
        'Bold', parent=styles['Normal'],
        fontSize=10, textColor=colors.HexColor('#1e293b'),
    )
    small_style = ParagraphStyle(
        'Small', parent=styles['Normal'],
        fontSize=8, textColor=colors.HexColor('#94a3b8'),
    )

    # --- Shop Header ---
    shop_name = shop_settings.shop_name or "Retail Store"
    elements.append(Paragraph(f"<b>{shop_name}</b>", title_style))

    if shop_settings.shop_address:
        elements.append(Paragraph(shop_settings.shop_address, subtitle_style))
    shop_contact_parts = []
    if shop_settings.shop_phone:
        shop_contact_parts.append(f"Phone: {shop_settings.shop_phone}")
    if shop_settings.shop_email:
        shop_contact_parts.append(f"Email: {shop_settings.shop_email}")
    if shop_contact_parts:
        elements.append(Paragraph(" | ".join(shop_contact_parts), subtitle_style))
    if shop_settings.shop_gstin:
        elements.append(Paragraph(f"<b>GSTIN: {shop_settings.shop_gstin}</b>", subtitle_style))

    elements.append(Spacer(1, 3 * mm))

    # Divider
    divider_data = [['TAX INVOICE']]
    divider_table = Table(divider_data, colWidths=[doc.width])
    divider_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#4F46E5')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(divider_table)
    elements.append(Spacer(1, 3 * mm))

    # --- Invoice Meta + Customer Info ---
    invoice_number = sale.invoice_number
    sale_date = sale.sale_date or sale.created_at
    date_str = sale_date.strftime("%d/%m/%Y %I:%M %p") if sale_date else datetime.now().strftime("%d/%m/%Y %I:%M %p")

    left_col = [
        Paragraph(f"<b>Invoice No:</b> {invoice_number}", header_style),
        Paragraph(f"<b>Date:</b> {date_str}", header_style),
        Paragraph(f"<b>Payment:</b> {sale.payment_method.value.upper() if hasattr(sale.payment_method, 'value') else str(sale.payment_method).upper()}", header_style),
    ]

    if customer:
        right_col = [
            Paragraph(f"<b>Customer:</b> {customer.customer_name}", header_style),
            Paragraph(f"<b>Phone:</b> {customer.phone_number or 'N/A'}", header_style),
            Paragraph(f"<b>GSTIN:</b> {customer.gstin or 'N/A'}", header_style),
        ]
    else:
        right_col = [
            Paragraph("<b>Customer:</b> Walk-in", header_style),
            Paragraph("", header_style),
            Paragraph("", header_style),
        ]

    meta_data = [[left_col[i], right_col[i]] for i in range(3)]
    meta_table = Table(meta_data, colWidths=[doc.width / 2, doc.width / 2])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 4 * mm))

    # --- Product Table ---
    has_igst = any(item.igst > 0 for item in items)

    if has_igst:
        table_header = ['#', 'Item', 'HSN', 'Qty', 'Rate', 'Disc', 'IGST', 'Total']
        col_widths = [8 * mm, 55 * mm, 20 * mm, 15 * mm, 22 * mm, 18 * mm, 20 * mm, 25 * mm]
    else:
        table_header = ['#', 'Item', 'HSN', 'Qty', 'Rate', 'Disc', 'CGST', 'SGST', 'Total']
        col_widths = [8 * mm, 48 * mm, 18 * mm, 13 * mm, 20 * mm, 15 * mm, 18 * mm, 18 * mm, 25 * mm]

    table_data = [table_header]
    for idx, item in enumerate(items, 1):
        if has_igst:
            row = [
                str(idx),
                item.product_name,
                item.hsn_code or '',
                str(item.quantity),
                f"₹{item.unit_price:,.2f}",
                f"₹{item.discount:,.2f}" if item.discount else "-",
                f"₹{item.igst:,.2f}",
                f"₹{item.total:,.2f}",
            ]
        else:
            row = [
                str(idx),
                item.product_name,
                item.hsn_code or '',
                str(item.quantity),
                f"₹{item.unit_price:,.2f}",
                f"₹{item.discount:,.2f}" if item.discount else "-",
                f"₹{item.cgst:,.2f}",
                f"₹{item.sgst:,.2f}",
                f"₹{item.total:,.2f}",
            ]
        table_data.append(row)

    product_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    product_table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#334155')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        # Body
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#475569')),
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        # Alternating rows
        *[('BACKGROUND', (0, i), (-1, i), colors.HexColor('#fafafa')) for i in range(2, len(table_data), 2)],
    ]))
    elements.append(product_table)
    elements.append(Spacer(1, 4 * mm))

    # --- Tax Summary & Totals ---
    summary_right_style = ParagraphStyle('SummaryRight', parent=styles['Normal'], fontSize=9, alignment=TA_RIGHT)
    summary_bold_style = ParagraphStyle('SummaryBold', parent=styles['Normal'], fontSize=10, alignment=TA_RIGHT)

    totals_data = [
        ['', 'Subtotal:', f"₹{sale.subtotal:,.2f}"],
    ]
    if sale.discount_amount > 0:
        totals_data.append(['', 'Discount:', f"-₹{sale.discount_amount:,.2f}"])
    if has_igst:
        totals_data.append(['', f'IGST:', f"₹{sale.igst:,.2f}"])
    else:
        totals_data.append(['', 'CGST:', f"₹{sale.cgst:,.2f}"])
        totals_data.append(['', 'SGST:', f"₹{sale.sgst:,.2f}"])

    totals_data.append(['', '', ''])  # separator
    totals_data.append(['', 'Grand Total:', f"₹{sale.total_amount:,.2f}"])

    if sale.payment_method.value == 'credit' if hasattr(sale.payment_method, 'value') else sale.payment_method == 'credit':
        totals_data.append(['', 'Amount Paid:', f"₹{sale.amount_paid:,.2f}"])
        totals_data.append(['', 'Amount Due:', f"₹{sale.amount_due:,.2f}"])

    totals_table = Table(totals_data, colWidths=[doc.width * 0.5, doc.width * 0.25, doc.width * 0.25])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#475569')),
        # Grand total row - bold
        ('FONTNAME', (1, -1 if sale.payment_method != 'credit' else -3), (2, -1 if sale.payment_method != 'credit' else -3), 'Helvetica-Bold'),
        ('FONTSIZE', (1, -1 if sale.payment_method != 'credit' else -3), (2, -1 if sale.payment_method != 'credit' else -3), 11),
        ('TEXTCOLOR', (1, -1 if sale.payment_method != 'credit' else -3), (2, -1 if sale.payment_method != 'credit' else -3), colors.HexColor('#1e293b')),
        ('LINEABOVE', (1, -1 if sale.payment_method != 'credit' else -3), (2, -1 if sale.payment_method != 'credit' else -3), 1, colors.HexColor('#4F46E5')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 2 * mm))

    # Total in words
    total_words = _number_to_words(sale.total_amount)
    elements.append(Paragraph(f"<b>Amount in words:</b> {total_words}", small_style))
    elements.append(Spacer(1, 5 * mm))

    # --- QR Code + Signature ---
    qr_data = f"Invoice: {invoice_number} | Total: ₹{sale.total_amount} | GSTIN: {shop_settings.shop_gstin or 'N/A'}"
    qr_buffer = _generate_qr_code(qr_data)
    qr_image = Image(qr_buffer, width=25 * mm, height=25 * mm)

    footer_data = [[
        qr_image,
        '',
        Paragraph("<br/><br/><br/>________________________<br/>Authorized Signature", ParagraphStyle(
            'Sig', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor('#64748b'),
        )),
    ]]
    footer_table = Table(footer_data, colWidths=[doc.width * 0.3, doc.width * 0.4, doc.width * 0.3])
    footer_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (2, 0), (2, 0), 'CENTER'),
    ]))
    elements.append(footer_table)
    elements.append(Spacer(1, 3 * mm))

    # Thank you
    elements.append(Paragraph(
        "Thank you for your business!",
        ParagraphStyle('ThankYou', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER,
                       textColor=colors.HexColor('#4F46E5')),
    ))

    # Terms
    elements.append(Spacer(1, 3 * mm))
    elements.append(Paragraph(
        "Terms: Goods once sold will not be taken back. All disputes subject to local jurisdiction.",
        ParagraphStyle('Terms', parent=styles['Normal'], fontSize=7, alignment=TA_CENTER,
                       textColor=colors.HexColor('#94a3b8')),
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer
