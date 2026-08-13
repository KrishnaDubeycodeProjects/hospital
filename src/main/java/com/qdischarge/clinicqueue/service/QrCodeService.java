package com.qdischarge.clinicqueue.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageConfig;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;

/**
 * Java port of the "qrcode" npm package usage in routes/queue.js
 * (QRCode.toBuffer with type 'png', width 350, margin 2, dark/light colors).
 */
@Service
public class QrCodeService {

    public byte[] generatePng(String content, int size, int margin, String darkHex, String lightHex)
            throws WriterException, IOException {
        Map<EncodeHintType, Object> hints = Map.of(
                EncodeHintType.MARGIN, margin,
                EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);

        BitMatrix matrix = new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, hints);

        MatrixToImageConfig config = new MatrixToImageConfig(
                Color.decode(darkHex).getRGB(),
                Color.decode(lightHex).getRGB());

        BufferedImage image = MatrixToImageWriter.toBufferedImage(matrix, config);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, "png", baos);
        return baos.toByteArray();
    }
}
